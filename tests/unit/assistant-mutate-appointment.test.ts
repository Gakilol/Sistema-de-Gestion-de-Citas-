import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  availability: vi.fn(),
  conflicts: vi.fn(),
  validateExact: vi.fn(),
  queryRaw: vi.fn(),
  citaFindUnique: vi.fn(),
  citaUpdate: vi.fn(),
  empleadoFindUnique: vi.fn(),
}));

vi.mock('@/lib/appointments/appointment-availability', () => ({
  calculateAppointmentAvailability: mocks.availability,
  findAppointmentConflicts: mocks.conflicts,
  validateExactAppointmentTime: mocks.validateExact,
}));

import {
  cancelAppointmentInTransaction,
  rescheduleAppointmentInTransaction,
} from '../../lib/appointments/mutate-appointment';

const EMP_1 = '22222222-2222-4222-8222-222222222222';
const EMP_2 = '22222222-2222-4222-8222-222222222223';
const CITA_ID = '55555555-5555-4555-8555-555555555555';

const baseCita = () => ({
  id: CITA_ID,
  cliente_id: '11111111-1111-4111-8111-111111111111',
  cliente_nombre: 'Ana López',
  empleado_id: EMP_1,
  servicio_id: '33333333-3333-4333-8333-333333333333',
  fecha: new Date('2026-11-20T00:00:00Z'),
  hora: '14:00',
  duracion: 30,
  estado: 'CONFIRMADA',
  updated_at: new Date('2026-11-19T08:00:00Z'),
  citaServicios: [],
});

const tx = {
  $queryRaw: mocks.queryRaw,
  cita: { findUnique: mocks.citaFindUnique, update: mocks.citaUpdate },
  empleado: { findUnique: mocks.empleadoFindUnique },
} as unknown as import('@prisma/client').Prisma.TransactionClient;

describe('reprogramación y cancelación transaccional compartida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([]);
    mocks.citaFindUnique.mockResolvedValue(baseCita());
    mocks.empleadoFindUnique.mockResolvedValue({ activo: true, esAgendable: true });
    mocks.conflicts.mockResolvedValue([]);
    mocks.availability.mockResolvedValue({
      disponible: true,
      jornada: { inicio: '08:00', fin: '18:00' },
      intervalosOcupados: [],
      turnosEmpleado: undefined,
    });
    mocks.validateExact.mockReturnValue({ valida: true, motivo: 'Disponible' });
    mocks.citaUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...baseCita(),
      ...data,
    }));
  });

  it('reprograma validando bloqueo asesor, exclusión de cita propia y disponibilidad', async () => {
    const result = await rescheduleAppointmentInTransaction(tx, {
      citaId: CITA_ID,
      targetEmpleadoId: EMP_1,
      fecha: '2026-11-21',
      hora: '10:00',
      userId: 'admin-1',
      userRole: 'ADMIN',
      expectedUpdatedAt: '2026-11-19T08:00:00.000Z',
    });

    expect(result.status).toBe(200);
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
    expect(mocks.conflicts).toHaveBeenCalledWith(EMP_1, '2026-11-21', '10:00', 30, CITA_ID, tx);
    expect(mocks.availability).toHaveBeenCalledWith(EMP_1, '2026-11-21', baseCita().servicio_id, 30, '10:00', CITA_ID, false, tx);
    expect(mocks.citaUpdate).toHaveBeenCalledTimes(1);
  });

  it('bloquea reprogramación en estados terminales, edición concurrente, traslape y falta de permisos', async () => {
    mocks.citaFindUnique.mockResolvedValueOnce({ ...baseCita(), estado: 'COMPLETADA' });
    expect(
      await rescheduleAppointmentInTransaction(tx, {
        citaId: CITA_ID,
        targetEmpleadoId: EMP_1,
        fecha: '2026-11-21',
        hora: '10:00',
        userId: 'admin-1',
        userRole: 'ADMIN',
      }),
    ).toMatchObject({ status: 422 });

    expect(
      await rescheduleAppointmentInTransaction(tx, {
        citaId: CITA_ID,
        targetEmpleadoId: EMP_1,
        fecha: '2026-11-21',
        hora: '10:00',
        userId: 'admin-1',
        userRole: 'ADMIN',
        expectedUpdatedAt: '2026-11-19T07:00:00.000Z',
      }),
    ).toMatchObject({ status: 409, type: 'CONCURRENT_EDIT' });

    mocks.conflicts.mockResolvedValueOnce([{ appointmentId: 'otra', allowOverlap: false }]);
    expect(
      await rescheduleAppointmentInTransaction(tx, {
        citaId: CITA_ID,
        targetEmpleadoId: EMP_1,
        fecha: '2026-11-21',
        hora: '10:00',
        userId: 'admin-1',
        userRole: 'ADMIN',
      }),
    ).toMatchObject({ status: 409, type: 'SCHEDULE_OVERLAP' });

    expect(
      await rescheduleAppointmentInTransaction(tx, {
        citaId: CITA_ID,
        targetEmpleadoId: EMP_2,
        fecha: '2026-11-21',
        hora: '10:00',
        userId: EMP_2,
        userRole: 'EMPLEADO',
      }),
    ).toMatchObject({ status: 403 });

    expect(mocks.citaUpdate).not.toHaveBeenCalled();
  });

  it('cancela cita respetando permisos, estado editable y concurrencia', async () => {
    expect(
      await cancelAppointmentInTransaction(tx, {
        citaId: CITA_ID,
        userId: EMP_2,
        userRole: 'EMPLEADO',
      }),
    ).toMatchObject({ status: 403 });

    mocks.citaFindUnique.mockResolvedValueOnce({ ...baseCita(), estado: 'CANCELADA' });
    expect(
      await cancelAppointmentInTransaction(tx, {
        citaId: CITA_ID,
        userId: 'admin-1',
        userRole: 'ADMIN',
      }),
    ).toMatchObject({ status: 422 });

    const ok = await cancelAppointmentInTransaction(tx, {
      citaId: CITA_ID,
      userId: EMP_1,
      userRole: 'EMPLEADO',
      expectedUpdatedAt: '2026-11-19T08:00:00.000Z',
    });
    expect(ok.status).toBe(200);
    expect(mocks.citaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CITA_ID },
        data: expect.objectContaining({ estado: 'CANCELADA' }),
      }),
    );
  });
});
