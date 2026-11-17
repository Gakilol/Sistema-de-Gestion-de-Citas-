import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), create: vi.fn(), audit: vi.fn(), transaction: vi.fn(), lock: vi.fn(), catalog: vi.fn(), availability: vi.fn() }));
vi.mock('@/lib/appointments/create-appointment', () => ({ createAppointmentInTransaction: mocks.create }));
vi.mock('@/lib/audit/audit-logger', () => ({ logAudit: mocks.audit }));
vi.mock('@/lib/timezone', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/timezone')>(), getBusinessTodayString: () => '2026-11-17', getBusinessNowTime: () => '08:00' }));
vi.mock('@/lib/db', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('@/lib/ia/provider', () => ({ interpretCommand: vi.fn() }));
vi.mock('@/lib/appointments/appointment-availability', () => ({ calculateAppointmentAvailability: mocks.availability }));
import { confirmDraft } from '../../lib/ia/service';

const user = { id: 'admin-1', rol: 'ADMIN' as const };
const payload = {
  clienteId: '11111111-1111-4111-8111-111111111111', empleadoId: '22222222-2222-4222-8222-222222222222',
  servicios: [{ id: '33333333-3333-4333-8333-333333333333', nombre: 'Corte', duracion: 30 }], fecha: '2026-11-18', hora: '15:00',
};
const fresh = () => ({ id: 'draft-1', userId: user.id, revision: 2, estado: 'BORRADOR', expiresAt: new Date(Date.now() + 900000), payload, citaId: null as string | null });
const tx = {
  $queryRaw: mocks.lock,
  iaBorrador: { findFirst: mocks.find, update: mocks.update },
  cliente: { findUnique: async () => ({ nombre: 'Cliente interno', telefono: '88889999' }) },
  empleado: { findUnique: async () => ({ activo: true, esAgendable: true }) },
  servicio: { findMany: mocks.catalog },
};

describe('confirmación de citas del asistente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (db: typeof tx) => unknown) => callback(tx));
    mocks.find.mockResolvedValue(fresh()); mocks.catalog.mockResolvedValue(payload.servicios);
    mocks.create.mockResolvedValue({ cita: { id: 'cita-1' }, conflictos: [], status: 201 });
    mocks.update.mockResolvedValue({}); mocks.audit.mockResolvedValue(true);
    mocks.availability.mockResolvedValue({ disponible: true, bloques: [{ hora: '15:00', disponible: true }] });
  });
  it('comprueba disponibilidad dentro del escritor compartido y consume el borrador', async () => {
    const result = await confirmDraft(user, 'draft-1', 2);
    expect(result).toMatchObject({ status: 201, body: { citaId: 'cita-1' } });
    expect(mocks.create).toHaveBeenCalledWith(tx, expect.objectContaining({ permitirHorarioExtendido: false, allowOverlap: false, finalEmpleadoId: payload.empleadoId, serviciosParaCita: payload.servicios }));
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'draft-1' }, data: { estado: 'CONFIRMADO', citaId: 'cita-1' } });
  });
  it('un reintento devuelve la cita existente sin crear ni auditar otra', async () => {
    mocks.find.mockResolvedValue({ ...fresh(), estado: 'CONFIRMADO', citaId: 'cita-1' });
    expect(await confirmDraft(user, 'draft-1', 2)).toMatchObject({ status: 200, body: { citaId: 'cita-1', replay: true } });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('serializa dos confirmaciones simultáneas del mismo borrador', async () => {
    const draft = fresh();
    mocks.find.mockImplementation(async () => ({ ...draft }));
    mocks.update.mockImplementation(async ({ data }) => { Object.assign(draft, data); return draft; });
    let queue = Promise.resolve();
    mocks.transaction.mockImplementation((callback: (db: typeof tx) => Promise<unknown>) => {
      const next = queue.then(() => callback(tx)); queue = next.then(() => undefined); return next;
    });
    const results = await Promise.all([confirmDraft(user, 'draft-1', 2), confirmDraft(user, 'draft-1', 2)]);
    expect(results.map(result => result.status)).toEqual([201, 200]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it('rechaza un borrador ajeno, una revisión anterior y un borrador vencido', async () => {
    mocks.find.mockResolvedValueOnce(null);
    await expect(confirmDraft(user, 'draft-1', 2)).rejects.toMatchObject({ status: 404 });
    await expect(confirmDraft(user, 'draft-1', 1)).rejects.toMatchObject({ status: 409 });
    mocks.find.mockResolvedValueOnce({ ...fresh(), expiresAt: new Date(0) });
    await expect(confirmDraft(user, 'draft-1', 2)).rejects.toMatchObject({ status: 409 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('impide que un empleado registre citas en otra agenda', async () => {
    await expect(confirmDraft({ id: 'employee-other', rol: 'EMPLEADO' }, 'draft-1', 2)).rejects.toMatchObject({ status: 403 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('un conflicto aparecido antes de confirmar no consume el borrador', async () => {
    mocks.create.mockResolvedValue({ type: 'SCHEDULE_OVERLAP', status: 409 });
    await expect(confirmDraft(user, 'draft-1', 2)).rejects.toMatchObject({ status: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('un cambio de duración renueva la revisión y exige otra confirmación', async () => {
    mocks.catalog.mockResolvedValue([{ ...payload.servicios[0], duracion: 45 }]);
    mocks.update.mockResolvedValue({ ...fresh(), revision: 3 });
    expect(await confirmDraft(user, 'draft-1', 2)).toMatchObject({ status: 409, body: { draft: { revision: 3, servicios: [{ duracion: 45 }] } } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rechaza una fecha pasada aunque el borrador se haya manipulado', async () => {
    mocks.find.mockResolvedValue({ ...fresh(), payload: { ...payload, fecha: '2026-11-16' } });
    await expect(confirmDraft(user, 'draft-1', 2)).rejects.toMatchObject({ status: 400 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
