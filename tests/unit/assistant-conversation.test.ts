import { beforeEach, describe, expect, it, vi } from 'vitest';

const ANA_1_ID = '11111111-1111-4111-8111-111111111111';
const ANA_2_ID = '11111111-1111-4111-8111-111111111112';
const CARLOS_ID = '22222222-2222-4222-8222-222222222222';
const MARIA_ID = '22222222-2222-4222-8222-222222222223';
const CORTE_ID = '33333333-3333-4333-8333-333333333333';
const TINTE_ID = '33333333-3333-4333-8333-333333333334';
const DRAFT_ID = '44444444-4444-4444-8444-444444444444';
const CITA_EXISTENTE_ID = '55555555-5555-4555-8555-555555555555';

const mocks = vi.hoisted(() => ({
  resolveClient: vi.fn(),
  availability: vi.fn(),
  interpret: vi.fn(),
  createCita: vi.fn(),
  rescheduleCita: vi.fn(),
  cancelCita: vi.fn(),
  audit: vi.fn(),
  servicioFindMany: vi.fn(),
  empleadoFindMany: vi.fn(),
  empleadoFindUnique: vi.fn(),
  clienteFindUnique: vi.fn(),
  clienteFindMany: vi.fn(),
  citaFindMany: vi.fn(),
  citaCount: vi.fn(),
  citaGroupBy: vi.fn(),
  draftStore: new Map<string, { id: string; userId: string; revision: number; estado: string; payload: unknown; expiresAt: Date; citaId: string | null }>(),
}));

vi.mock('@/lib/timezone', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/timezone')>(),
  // Thursday 2026-11-19 at 10:00 AM Costa Rica -> Friday is 2026-11-20, Saturday is 2026-11-21
  getBusinessTodayString: () => '2026-11-19',
  getBusinessNowTime: () => '10:00',
}));

vi.mock('@/lib/clients/client-search', () => ({
  resolveClientDirectory: mocks.resolveClient,
}));

vi.mock('@/lib/appointments/appointment-availability', () => ({
  calculateAppointmentAvailability: mocks.availability,
  timeToMinutes: (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  },
}));

vi.mock('@/lib/ia/provider', () => ({
  interpretCommand: mocks.interpret,
}));

vi.mock('@/lib/appointments/create-appointment', () => ({
  createAppointmentInTransaction: mocks.createCita,
}));

vi.mock('@/lib/appointments/mutate-appointment', () => ({
  rescheduleAppointmentInTransaction: mocks.rescheduleCita,
  cancelAppointmentInTransaction: mocks.cancelCita,
}));

vi.mock('@/lib/audit/audit-logger', () => ({
  logAudit: mocks.audit,
}));

vi.mock('@/lib/db', () => {
  const iaBorrador = {
    findFirst: vi.fn(async ({ where }: { where: { id?: string; userId?: string } }) => {
      const row = where.id ? mocks.draftStore.get(where.id) : undefined;
      if (!row || (where.userId && row.userId !== where.userId)) return null;
      return { ...row };
    }),
    create: vi.fn(async ({ data }: { data: { userId: string; payload: unknown; expiresAt: Date } }) => {
      const row = {
        id: DRAFT_ID,
        userId: data.userId,
        revision: 1,
        estado: 'BORRADOR',
        payload: data.payload,
        expiresAt: data.expiresAt,
        citaId: null,
      };
      mocks.draftStore.set(row.id, row);
      return { ...row };
    }),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; userId: string; revision?: number; estado?: string }; data: { payload?: unknown; revision?: { increment: number }; expiresAt?: Date; estado?: string } }) => {
      const row = mocks.draftStore.get(where.id);
      if (!row || row.userId !== where.userId) return { count: 0 };
      if (where.revision !== undefined && row.revision !== where.revision) return { count: 0 };
      if (where.estado && row.estado !== where.estado) return { count: 0 };
      if (data.payload !== undefined) row.payload = data.payload;
      if (data.revision?.increment) row.revision += data.revision.increment;
      if (data.expiresAt) row.expiresAt = data.expiresAt;
      if (data.estado) row.estado = data.estado;
      return { count: 1 };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { payload?: unknown; revision?: { increment: number }; estado?: string; citaId?: string } }) => {
      const row = mocks.draftStore.get(where.id)!;
      if (data.payload !== undefined) row.payload = data.payload;
      if (data.revision?.increment) row.revision += data.revision.increment;
      if (data.estado) row.estado = data.estado;
      if (data.citaId !== undefined) row.citaId = data.citaId;
      return { ...row };
    }),
  };

  const prisma = {
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
    servicio: { findMany: mocks.servicioFindMany },
    empleado: { findMany: mocks.empleadoFindMany, findUnique: mocks.empleadoFindUnique },
    cliente: { findUnique: mocks.clienteFindUnique, findMany: mocks.clienteFindMany },
    cita: { findMany: mocks.citaFindMany, count: mocks.citaCount, groupBy: mocks.citaGroupBy },
    iaBorrador,
  };
  return { prisma };
});

import { chat, confirmDraft } from '../../lib/ia/service';

const admin = { id: 'admin-1', rol: 'ADMIN' as const };
const employeeCarlos = { id: CARLOS_ID, rol: 'EMPLEADO' as const };

const clientsDb = [
  { id: ANA_1_ID, nombre: 'Ana López', telefono: '8888-1111', correo: 'ana1@example.com', cedula: '1-1111-1111' },
  { id: ANA_2_ID, nombre: 'Ana López', telefono: '8888-2222', correo: 'ana2@example.com', cedula: '2-2222-2222' },
];

const employeesDb = [
  { id: CARLOS_ID, nombre: 'Carlos Méndez', activo: true, esAgendable: true },
  { id: MARIA_ID, nombre: 'María Solís', activo: true, esAgendable: true },
];

const servicesDb = [
  { id: CORTE_ID, nombre: 'Corte', duracion: 30 },
  { id: TINTE_ID, nombre: 'Tinte', duracion: 90 },
];

describe('experiencia conversacional completa del asistente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.draftStore.clear();
    mocks.audit.mockResolvedValue(true);

    mocks.servicioFindMany.mockImplementation(async ({ where }: { where?: { id?: { in?: string[] } } } = {}) => {
      if (where?.id?.in) return servicesDb.filter(s => where.id!.in!.includes(s.id));
      return servicesDb;
    });
    mocks.empleadoFindMany.mockImplementation(async ({ where }: { where?: { id?: string } }) => {
      if (where?.id) return employeesDb.filter(emp => emp.id === where.id);
      return employeesDb;
    });
    mocks.empleadoFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      employeesDb.find(emp => emp.id === where.id) ?? null,
    );
    mocks.clienteFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      clientsDb.find(client => client.id === where.id) ?? null,
    );
    mocks.clienteFindMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
      clientsDb.filter(client => where.id.in.includes(client.id)),
    );

    mocks.resolveClient.mockResolvedValue({ kind: 'found', client: clientsDb[0] });

    // Default Gemini mock: returns local intent and verifies ZERO PII was transmitted!
    mocks.interpret.mockImplementation(async (safeText: string, _today: string, local: unknown) => {
      expect(safeText).not.toMatch(/ana|lopez|8888|1111|2222|example\.com/i);
      return { intent: local, mode: 'gemini' };
    });

    // Friday (2026-11-20) has afternoon slots 14:00, 15:00, 16:00; Saturday (2026-11-21) has morning slots 09:00, 10:00, 11:00
    mocks.availability.mockImplementation(async (empId: string, fecha: string, _servId: string, duracion: number) => {
      if (fecha === '2026-11-20') {
        if (duracion >= 90) {
          return {
            disponible: true,
            bloques: [
              { hora: '14:00', disponible: false, motivo: 'Cita reservada' },
              { hora: '15:00', disponible: false, motivo: 'Cita reservada' },
              { hora: '16:00', disponible: false, motivo: 'Excede jornada' },
              { hora: '10:00', disponible: true, motivo: 'Disponible' },
            ],
          };
        }
        return {
          disponible: true,
          bloques: empId === CARLOS_ID
            ? [
                { hora: '10:00', disponible: true, motivo: 'Disponible' },
                { hora: '14:00', disponible: true, motivo: 'Disponible' },
                { hora: '15:00', disponible: true, motivo: 'Disponible' },
                { hora: '16:00', disponible: true, motivo: 'Disponible' },
              ]
            : [
                { hora: '14:00', disponible: false, motivo: 'Cita reservada' },
                { hora: '15:00', disponible: true, motivo: 'Disponible' },
              ],
        };
      }
      if (fecha === '2026-11-21') {
        return {
          disponible: true,
          bloques: [
            { hora: '09:00', disponible: true, motivo: 'Disponible' },
            { hora: '10:00', disponible: true, motivo: 'Disponible' },
            { hora: '11:00', disponible: true, motivo: 'Disponible' },
          ],
        };
      }
      return { disponible: false, motivo: 'Día no laboral', bloques: [] };
    });

    mocks.createCita.mockResolvedValue({ cita: { id: 'cita-creada-1' }, conflictos: [], status: 201 });
    mocks.rescheduleCita.mockResolvedValue({ cita: { id: CITA_EXISTENTE_ID }, beforeData: {}, status: 200 });
    mocks.cancelCita.mockResolvedValue({ cita: { id: CITA_EXISTENTE_ID, estado: 'CANCELADA' }, beforeData: {}, status: 200 });
  });

  it('ejecuta una conversación completa sin tabla: ofrecer horarios, «la segunda», «mejor a las cuatro», «¿y el sábado?», «sí, confirma» y confirmación en pantalla', async () => {
    // Turno 1: Agenda a Ana López para corte el viernes por la tarde (sin buscar cliente ni abrir tabla)
    const turn1 = await chat(admin, { mensaje: 'Agenda a Ana López para corte el viernes por la tarde' });
    expect(turn1.draft?.clienteNombre).toBe('Ana López');
    expect(turn1.draft?.servicios.map(s => s.nombre)).toEqual(['Corte']);
    expect(turn1.draft?.fecha).toBe('2026-11-20');
    expect(turn1.draft?.listo).toBe(false);
    expect(turn1.horariosOfrecidos?.map(s => s.hora)).toEqual(['14:00', '15:00', '16:00']);
    expect(turn1.spokenText).toContain('Ana López');
    expect(mocks.createCita).not.toHaveBeenCalled();

    // Verifica que Gemini recibió el comando reducido SIN el nombre del cliente
    expect(mocks.interpret).toHaveBeenCalledWith(
      'agenda a c0 para s0 el viernes por la tarde',
      '2026-11-19',
      expect.anything(),
      admin.id,
      expect.anything(),
    );

    // Turno 2: «la segunda» -> elige 15:00
    const turn2 = await chat(admin, {
      mensaje: 'la segunda',
      borradorId: turn1.draft!.id,
      revision: turn1.draft!.revision,
    });
    expect(turn2.draft?.hora).toBe('15:00');
    expect(turn2.draft?.profesionalNombre).toBe('Carlos Méndez');
    expect(turn2.draft?.listo).toBe(true);
    expect(mocks.createCita).not.toHaveBeenCalled();

    // Turno 3: «mejor a las cuatro» -> conserva Ana López, Corte y viernes; cambia hora a 16:00
    const turn3 = await chat(admin, {
      mensaje: 'mejor a las cuatro',
      borradorId: turn2.draft!.id,
      revision: turn2.draft!.revision,
    });
    expect(turn3.draft?.clienteNombre).toBe('Ana López');
    expect(turn3.draft?.fecha).toBe('2026-11-20');
    expect(turn3.draft?.hora).toBe('16:00');
    expect(turn3.draft?.listo).toBe(true);

    // Turno 4: «¿y el sábado?» -> conserva cliente y servicio, consulta sábado y ofrece horarios reales del sábado
    const turn4 = await chat(admin, {
      mensaje: '¿y el sábado?',
      borradorId: turn3.draft!.id,
      revision: turn3.draft!.revision,
    });
    expect(turn4.draft?.clienteNombre).toBe('Ana López');
    expect(turn4.draft?.servicios[0].nombre).toBe('Corte');
    expect(turn4.draft?.fecha).toBe('2026-11-21');
    expect(turn4.draft?.hora).toBeNull();
    expect(turn4.horariosOfrecidos?.map(s => s.hora)).toEqual(['09:00', '10:00', '11:00']);

    // Turno 5: «la primera» -> elige 09:00 del sábado
    const turn5 = await chat(admin, {
      mensaje: 'la primera',
      borradorId: turn4.draft!.id,
      revision: turn4.draft!.revision,
    });
    expect(turn5.draft?.fecha).toBe('2026-11-21');
    expect(turn5.draft?.hora).toBe('09:00');
    expect(turn5.draft?.listo).toBe(true);

    // Turno 6: «sí, confirma» por voz -> SOLO resalta el resumen pendiente, NUNCA crea la cita
    const turn6 = await chat(admin, {
      mensaje: 'sí, confirma',
      borradorId: turn5.draft!.id,
      revision: turn5.draft!.revision,
    });
    expect(turn6.highlightConfirmation).toBe(true);
    expect(turn6.draft?.listo).toBe(true);
    expect(mocks.createCita).not.toHaveBeenCalled();

    // Turno 7: Endpoint separado de confirmación en pantalla -> registra la cita
    const confirmed = await confirmDraft(admin, turn6.draft!.id, turn6.draft!.revision);
    expect(confirmed.status).toBe(201);
    expect(mocks.createCita).toHaveBeenCalledTimes(1);
  });

  it('pide aclaración mínima para clientes homónimos dentro de NovaCita y continúa sin perder contexto', async () => {
    mocks.resolveClient.mockResolvedValueOnce({ kind: 'ambiguous', clients: clientsDb });

    const turn1 = await chat(admin, { mensaje: 'Agenda a Ana López para corte el viernes por la tarde' });
    expect(turn1.clientesCandidatos).toEqual([
      { id: ANA_1_ID, nombre: 'Ana López', pista: 'tel. ···1111' },
      { id: ANA_2_ID, nombre: 'Ana López', pista: 'tel. ···2222' },
    ]);
    // Nunca expone teléfono completo ni cédula
    expect(turn1.text).not.toContain('8888-1111');
    expect(turn1.text).not.toContain('1-1111-1111');
    // Conserva servicio, fecha y franja
    expect(turn1.draft?.servicios[0].nombre).toBe('Corte');
    expect(turn1.draft?.fecha).toBe('2026-11-20');

    // Aclaración por dígitos finales dentro de NovaCita (sin enviar nada a Gemini)
    mocks.interpret.mockClear();
    const turn2 = await chat(admin, {
      mensaje: 'la de 2222',
      borradorId: turn1.draft!.id,
      revision: turn1.draft!.revision,
    });
    expect(mocks.interpret).not.toHaveBeenCalled();
    expect(turn2.draft?.clienteId).toBe(ANA_2_ID);
    expect(turn2.horariosOfrecidos?.map(s => s.hora)).toEqual(['14:00', '15:00', '16:00']);
  });

  it('si falta un solo dato pregunta únicamente por ese dato y reconsulta disponibilidad al cambiar servicio', async () => {
    const turn1 = await chat(admin, { mensaje: 'Agenda a Ana López para el viernes por la tarde' });
    expect(turn1.draft?.clienteId).toBe(ANA_1_ID);
    expect(turn1.draft?.fecha).toBe('2026-11-20');
    expect(turn1.text).toMatch(/¿Qué servicio/i);

    const turn2 = await chat(admin, {
      mensaje: 'Corte a las 3 de la tarde',
      borradorId: turn1.draft!.id,
      revision: turn1.draft!.revision,
    });
    expect(turn2.draft?.hora).toBe('15:00');
    expect(turn2.draft?.listo).toBe(true);

    // Cambiar servicio a Tinte (90 min) reconsulta disponibilidad y detecta que 15:00 ya no cabe
    const turn3 = await chat(admin, {
      mensaje: 'mejor tinte',
      borradorId: turn2.draft!.id,
      revision: turn2.draft!.revision,
    });
    expect(turn3.draft?.servicios[0].nombre).toBe('Tinte');
    expect(turn3.draft?.hora).toBeNull();
    expect(turn3.horariosOfrecidos?.map(s => s.hora)).toEqual(['10:00']);
  });

  it('consulta citas existentes por cliente respetando el alcance del empleado', async () => {
    mocks.citaFindMany.mockResolvedValue([
      {
        id: CITA_EXISTENTE_ID,
        cliente_nombre: 'Ana López',
        fecha: new Date('2026-11-20T00:00:00Z'),
        hora: '14:00',
        estado: 'CONFIRMADA',
        empleado: { nombre: 'Carlos Méndez' },
        servicio: { nombre: 'Corte' },
        citaServicios: [{ servicio: { nombre: 'Corte' } }],
      },
    ]);
    mocks.citaCount.mockResolvedValue(1);

    const reply = await chat(employeeCarlos, { mensaje: '¿Qué citas tiene Ana López?' });
    expect(reply.agenda).toHaveLength(1);
    expect(reply.agenda?.[0]).toMatchObject({ cliente: 'Ana López', hora: '14:00' });
    expect(mocks.citaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ empleado_id: CARLOS_ID, cliente_id: ANA_1_ID }),
      }),
    );
  });

  it('integra reprogramación y cancelación existentes exigiendo confirmación en pantalla', async () => {
    mocks.citaFindMany.mockResolvedValue([
      {
        id: CITA_EXISTENTE_ID,
        cliente_id: ANA_1_ID,
        cliente_nombre: 'Ana López',
        empleado_id: CARLOS_ID,
        fecha: new Date('2026-11-20T00:00:00Z'),
        hora: '14:00',
        duracion: 30,
        estado: 'CONFIRMADA',
        updated_at: new Date('2026-11-19T08:00:00Z'),
        empleado: { nombre: 'Carlos Méndez' },
        servicio: { id: CORTE_ID, nombre: 'Corte', duracion: 30 },
        citaServicios: [{ duracion: 30, servicio: { id: CORTE_ID, nombre: 'Corte', duracion: 30 } }],
      },
    ]);

    const resched1 = await chat(admin, { mensaje: 'Reprograma la cita de Ana López para el sábado' });
    expect(resched1.draft?.operacion).toBe('reprogramar');
    expect(resched1.draft?.citaObjetivoId).toBe(CITA_EXISTENTE_ID);
    expect(resched1.horariosOfrecidos?.map(s => s.hora)).toEqual(['09:00', '10:00', '11:00']);
    expect(mocks.rescheduleCita).not.toHaveBeenCalled();

    const resched2 = await chat(admin, {
      mensaje: 'la segunda',
      borradorId: resched1.draft!.id,
      revision: resched1.draft!.revision,
    });
    expect(resched2.draft?.listo).toBe(true);
    expect(resched2.draft?.hora).toBe('10:00');
    expect(mocks.rescheduleCita).not.toHaveBeenCalled();

    const confirmedResched = await confirmDraft(admin, resched2.draft!.id, resched2.draft!.revision);
    expect(confirmedResched.status).toBe(200);
    expect(mocks.rescheduleCita).toHaveBeenCalledTimes(1);

    // Flujo de cancelación
    mocks.draftStore.clear();
    const cancel1 = await chat(admin, { mensaje: 'Cancela la cita de Ana López' });
    expect(cancel1.draft?.operacion).toBe('cancelar');
    expect(cancel1.draft?.listo).toBe(true);
    expect(mocks.cancelCita).not.toHaveBeenCalled();

    const confirmedCancel = await confirmDraft(admin, cancel1.draft!.id, cancel1.draft!.revision);
    expect(confirmedCancel.status).toBe(200);
    expect(mocks.cancelCita).toHaveBeenCalledTimes(1);
  });

  it('ofrece alternativas reales del siguiente día hábil cuando no hay cupo en la fecha pedida', async () => {
    mocks.availability.mockImplementation(async (_empId: string, fecha: string) => {
      if (fecha === '2026-11-20') {
        return { disponible: false, motivo: 'Sin cupo', bloques: [] };
      }
      if (fecha === '2026-11-21') {
        return {
          disponible: true,
          bloques: [
            { hora: '10:00', disponible: true, motivo: 'Disponible' },
            { hora: '11:00', disponible: true, motivo: 'Disponible' },
          ],
        };
      }
      return { disponible: false, motivo: 'Día no laboral', bloques: [] };
    });

    const turn1 = await chat(admin, { mensaje: 'Agenda a Ana López para corte el viernes por la tarde' });
    expect(turn1.text).toMatch(/No hay cupo/i);
    expect(turn1.horariosOfrecidos).toEqual([
      { fecha: '2026-11-21', hora: '10:00', empleadoId: CARLOS_ID, empleadoNombre: 'Carlos Méndez' },
      { fecha: '2026-11-21', hora: '11:00', empleadoId: CARLOS_ID, empleadoNombre: 'Carlos Méndez' },
    ]);

    const turn2 = await chat(admin, {
      mensaje: 'la primera',
      borradorId: turn1.draft!.id,
      revision: turn1.draft!.revision,
    });
    expect(turn2.draft?.fecha).toBe('2026-11-21');
    expect(turn2.draft?.hora).toBe('10:00');
    expect(turn2.draft?.listo).toBe(true);
  });

  it('impide que un empleado agende en la agenda de otro profesional', async () => {
    mocks.empleadoFindMany.mockResolvedValue([employeesDb[0]]);
    await expect(
      chat(employeeCarlos, { mensaje: 'Agenda a Ana López para corte el viernes', empleadoId: MARIA_ID }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
