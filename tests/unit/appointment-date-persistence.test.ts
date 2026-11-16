import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { formatAppointmentDate } from '../../app/citas/appointment-page-utils';
import { getAppointmentDateString } from '../../lib/calendar-date-utils';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), lock: vi.fn(), createServices: vi.fn(),
  logAudit: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: {
  empleado: { findUnique: async () => ({ activo: true, esAgendable: true }) },
  servicio: { findMany: async () => [{ id: '22222222-2222-4222-8222-222222222222', duracion: 60 }] },
  cliente: { findUnique: async () => ({ nombre: 'Cliente de prueba', telefono: null }) },
  cita: { findUnique: mocks.findUnique, findMany: mocks.findMany },
  $transaction: (callback: (tx: unknown) => Promise<unknown>) => callback({
    $queryRaw: mocks.lock, cita: { create: mocks.create }, citaServicio: { createMany: mocks.createServices },
  }),
} }));
vi.mock('@/lib/auth-helpers', () => ({
  getUserContext: () => ({ userId: 'admin-1', userRole: 'ADMIN' }),
  getDefaultAppointmentScope: () => 'all', getScopedAppointmentWhere: () => ({}),
}));
vi.mock('@/lib/clients/client-search', () => ({ resolveClientDirectory: vi.fn() }));
vi.mock('@/lib/appointments/appointment-availability', () => ({
  calculateAppointmentAvailability: async () => ({
    disponible: true, jornada: { inicio: '08:00', fin: '18:00' }, intervalosOcupados: [],
  }),
  findAppointmentConflicts: async () => [], validateExactAppointmentTime: () => ({ valida: true }),
}));
vi.mock('@/lib/audit/audit-logger', () => ({ logAudit: mocks.logAudit, getClientIp: () => '127.0.0.1' }));

import { GET, POST } from '../../app/api/citas/route';

describe('fecha elegida al crear y consultar una cita', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['2026-09-26', '2026-10-01', '2027-01-01'])('conserva %s al guardar y serializar una columna DATE', async (fecha) => {
    const saved = { id: 'appointment-1', fecha: new Date(`${fecha}T00:00:00.000Z`), hora: '13:00' };
    mocks.create.mockImplementation(async ({ data }) => ({ ...data, id: saved.id }));
    mocks.findUnique.mockResolvedValue(saved);
    mocks.findMany.mockResolvedValue([saved]);

    const response = await POST(new NextRequest('http://localhost/api/citas', {
      method: 'POST', body: JSON.stringify({
        cliente_id: '33333333-3333-4333-8333-333333333333', cliente_nombre: 'Cliente de prueba',
        empleado_id: '11111111-1111-4111-8111-111111111111',
        servicio_id: '22222222-2222-4222-8222-222222222222', fecha, hora: '13:00',
      }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.fecha.toISOString()).toBe(`${fecha}T00:00:00.000Z`);
    expect((await response.json()).cita.fecha).toBe(`${fecha}T00:00:00.000Z`);
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'APPOINTMENT_CREATED', metadata: expect.objectContaining({ requestedDate: fecha }),
      afterData: expect.objectContaining({ fecha: saved.fecha }),
    }));

    const listing = await GET(new NextRequest(`http://localhost/api/citas?from=${fecha}&to=${fecha}`));
    const appointment = (await listing.json()).citas[0];
    expect(getAppointmentDateString(appointment.fecha)).toBe(fecha);
    expect(formatAppointmentDate(appointment.fecha)).toMatch(new RegExp(`^${fecha.slice(8)} `));
    expect(mocks.findMany.mock.calls[0][0].where.fecha).toEqual({ gte: saved.fecha, lte: saved.fecha });
  });
});
