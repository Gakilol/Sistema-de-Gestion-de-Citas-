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

import { GET } from '../../app/api/citas/route';

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
});
