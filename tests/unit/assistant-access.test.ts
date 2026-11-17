import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ context: vi.fn(), user: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { empleado: { findUnique: mocks.user } } }));
vi.mock('@/lib/auth-helpers', () => ({ getUserContext: mocks.context }));
import { requireAssistantUser, scopedEmployee } from '../../lib/ia/access';

describe('acceso al asistente', () => {
  beforeEach(() => {
    vi.stubEnv('NOVACITA_IA_ENABLED', 'true');
    mocks.context.mockReturnValue({ userId: 'user-1' });
    mocks.user.mockResolvedValue({ id: 'user-1', rol: 'EMPLEADO', activo: true });
  });
  it('exige una sesión y una cuenta vigente', async () => {
    mocks.context.mockReturnValueOnce({ userId: null });
    await expect(requireAssistantUser(new NextRequest('http://localhost/api/ia/chat'))).rejects.toMatchObject({ status: 401 });
    mocks.user.mockResolvedValueOnce({ id: 'user-1', rol: 'ADMIN', activo: false });
    await expect(requireAssistantUser(new NextRequest('http://localhost/api/ia/chat'))).rejects.toMatchObject({ status: 403 });
  });
  it('rechaza orígenes cruzados y respeta el interruptor de entorno', async () => {
    await expect(requireAssistantUser(new NextRequest('http://localhost/api/ia/chat', { headers: { Origin: 'https://otro.example' } }))).rejects.toMatchObject({ status: 403 });
    vi.stubEnv('NOVACITA_IA_ENABLED', 'false');
    await expect(requireAssistantUser(new NextRequest('http://localhost/api/ia/chat'))).rejects.toMatchObject({ status: 503 });
  });
  it('deriva el rol de la cuenta y aplica el alcance propio al empleado', async () => {
    expect(await requireAssistantUser(new NextRequest('http://localhost/api/ia/chat'))).toEqual({ id: 'user-1', rol: 'EMPLEADO' });
    expect(scopedEmployee({ id: 'user-1', rol: 'EMPLEADO' }, null)).toBe('user-1');
    expect(() => scopedEmployee({ id: 'user-1', rol: 'EMPLEADO' }, 'otro')).toThrow();
  });
});
