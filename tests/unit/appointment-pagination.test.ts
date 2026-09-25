import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const findMany = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ prisma: { cita: { findMany } } }));
vi.mock('@/lib/auth-helpers', () => ({
  getUserContext: () => ({ userId: 'staff-1', userRole: 'EMPLEADO' }),
  getDefaultAppointmentScope: () => 'mine',
  getScopedAppointmentWhere: () => ({ empleado_id: 'staff-1' }),
}));
vi.mock('@/lib/clients/client-search', () => ({ resolveClientDirectory: vi.fn() }));

import { GET, POST } from '../../app/api/citas/route';

describe('paginación de citas del calendario', () => {
  beforeEach(() => findMany.mockReset());

  it('devuelve un cursor sin perder la siguiente cita y mantiene los filtros', async () => {
    findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const response = await GET(new NextRequest('http://localhost/api/citas?from=2026-09-01&to=2026-09-30&limit=2'));
    expect(await response.json()).toEqual({ citas: [{ id: 'a' }, { id: 'b' }], limit: 2, nextCursor: 'b' });
    findMany.mockResolvedValueOnce([{ id: 'c' }]);
    const next = await GET(new NextRequest('http://localhost/api/citas?from=2026-09-01&to=2026-09-30&limit=2&cursor=b'));
    expect(await next.json()).toEqual({ citas: [{ id: 'c' }], limit: 2, nextCursor: null });
    expect(findMany.mock.calls[1][0]).toMatchObject({
      cursor: { id: 'b' }, skip: 1, take: 3,
      where: { empleado_id: 'staff-1', fecha: { gte: new Date('2026-09-01T00:00:00Z'), lte: new Date('2026-09-30T00:00:00Z') } },
    });
  });

  it('termina al llegar a una página exactamente llena', async () => {
    findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    const response = await GET(new NextRequest('http://localhost/api/citas?limit=2'));
    expect((await response.json()).nextCursor).toBeNull();
  });

  it('rechaza filtros con fechas inexistentes sin consultar la base', async () => {
    const response = await GET(new NextRequest('http://localhost/api/citas?from=2026-02-30'));
    expect(response.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rechaza una cita con fecha inexistente antes de intentar guardarla', async () => {
    const response = await POST(new NextRequest('http://localhost/api/citas', {
      method: 'POST',
      body: JSON.stringify({
        cliente_nombre: 'Cliente de prueba',
        empleado_id: '11111111-1111-4111-8111-111111111111',
        servicio_id: '22222222-2222-4222-8222-222222222222',
        fecha: '2026-02-30', hora: '10:00',
      }),
    }));
    expect(response.status).toBe(400);
  });
});
