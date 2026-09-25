import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findOriginal: vi.fn(),
  findOnDate: vi.fn(),
  findInTransaction: vi.fn(),
  update: vi.fn(),
  lock: vi.fn(),
  availability: vi.fn(),
  conflicts: vi.fn(),
  exact: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    cita: { findUnique: mocks.findOriginal, findMany: mocks.findOnDate },
    empleado: { findUnique: async () => ({ activo: true, esAgendable: true }) },
    $transaction: (callback: (tx: unknown) => Promise<unknown>) => callback({
      cita: { findUnique: mocks.findInTransaction, update: mocks.update },
      $queryRaw: mocks.lock,
    }),
  },
}));
vi.mock('@/lib/auth-helpers', () => ({
  getUserContext: () => ({ userId: 'admin-1', userRole: 'ADMIN', userEmail: 'admin@example.test' }),
}));
vi.mock('@/lib/appointments/appointment-availability', () => ({
  calculateAppointmentAvailability: mocks.availability,
  findAppointmentConflicts: mocks.conflicts,
  validateExactAppointmentTime: mocks.exact,
  timeToMinutes: (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)),
}));
vi.mock('@/lib/audit/audit-logger', () => ({ logAudit: mocks.logAudit, getClientIp: () => '127.0.0.1' }));

import { PATCH } from '../../app/api/citas/[id]/route';

const original = {
  id: 'cita-1', fecha: new Date('2026-09-25T00:00:00.000Z'), hora: '10:00',
  duracion: 60, empleado_id: 'empleado-1', servicio_id: 'servicio-1',
  citaServicios: [{ servicio_id: 'servicio-1', duracion: 60, orden: 0 }],
  estado: 'CONFIRMADA', cliente_nombre: 'Ana', updated_at: new Date('2026-09-24T12:00:00Z'),
};

function request(body: object) {
  return new NextRequest('http://localhost/api/citas/cita-1', { method: 'PATCH', body: JSON.stringify(body) });
}

describe('edición de citas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findOriginal.mockResolvedValue(original);
    mocks.findInTransaction.mockResolvedValue(original);
    mocks.findOnDate.mockResolvedValue([]);
    mocks.availability.mockResolvedValue({ disponible: true, jornada: { inicio: '08:00', fin: '18:00' }, intervalosOcupados: [] });
    mocks.exact.mockReturnValue({ valida: true, motivo: '' });
    mocks.lock.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('rechaza un cruce aparecido después de la comprobación inicial y antes de guardar', async () => {
    mocks.conflicts.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      appointmentId: 'otra-cita', allowOverlap: false, startTime: '11:00', endTime: '12:00',
    }]);

    const response = await PATCH(request({ hora: '11:00' }), { params: Promise.resolve({ id: 'cita-1' }) });
    expect(response.status).toBe(409);
    expect((await response.json()).type).toBe('SCHEDULE_OVERLAP');
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('permite editar notas de una cita completada sin cambiar ni recalcular su horario', async () => {
    mocks.findOriginal.mockResolvedValue({ ...original, estado: 'COMPLETADA' });
    mocks.update.mockResolvedValue({ ...original, estado: 'COMPLETADA', notas: 'Nueva nota' });

    const response = await PATCH(request({
      fecha: '2026-09-25', hora: '10:00', duracion: 60, empleado_id: 'empleado-1',
      servicios_seleccionados: [{ id: 'servicio-1', duracion: 60 }], notas: 'Nueva nota',
    }), { params: Promise.resolve({ id: 'cita-1' }) });

    expect(response.status).toBe(200);
    expect(mocks.availability).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledOnce();
  });
});
