import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getBusinessNowTime, getBusinessTodayString, isValidBusinessDateString, parseLocalDateToUTC } from '@/lib/timezone';
import { calculateAppointmentAvailability } from '@/lib/appointments/appointment-availability';
import { createAppointmentInTransaction } from '@/lib/appointments/create-appointment';
import { logAudit } from '@/lib/audit/audit-logger';
import { AssistantError, scopedEmployee, type AssistantUser } from './access';
import { DraftPayloadSchema, type AssistantReply, type DraftPayload, type DraftView, type ChatInputSchema } from './domain';
import { addDays, parseLocalCommand, prepareSafeCommand, validIntentDate } from './intent';
import { interpretCommand } from './provider';
import type { z } from 'zod';

type Db = Prisma.TransactionClient;
const help = 'Selecciona un cliente y pide, por ejemplo: «Agenda corte mañana a las tres de la tarde». También puedes consultar «Mi agenda de hoy», «Horarios disponibles mañana» o «Resumen de esta semana». Los nombres y datos de clientes se completan en pantalla.';

export async function assistantCatalog(user: AssistantUser, db: Db = prisma) {
  const [servicios, empleados] = await Promise.all([
    db.servicio.findMany({ where: { activo: true }, select: { id: true, nombre: true, duracion: true }, orderBy: { nombre: 'asc' }, take: 200 }),
    db.empleado.findMany({ where: { activo: true, esAgendable: true, ...(user.rol === 'EMPLEADO' ? { id: user.id } : {}) }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' }, take: 100 }),
  ]);
  return { servicios, empleados };
}

export function requireFutureTime(fecha: string, hora: string) {
  if (!isValidBusinessDateString(fecha) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new AssistantError('La fecha o la hora no es válida.');
  const today = getBusinessTodayString();
  if (fecha < today || (fecha === today && hora <= getBusinessNowTime())) throw new AssistantError('Elige una fecha y hora futuras para la nueva cita.');
}

async function draftView(id: string, revision: number, expiresAt: Date, payload: DraftPayload, user: AssistantUser, db: Db = prisma): Promise<DraftView> {
  const [cliente, empleado] = await Promise.all([
    payload.clienteId ? db.cliente.findUnique({ where: { id: payload.clienteId }, select: { nombre: true } }) : null,
    payload.empleadoId ? db.empleado.findUnique({ where: { id: payload.empleadoId }, select: { nombre: true, activo: true, esAgendable: true } }) : null,
  ]);
  const faltantes: string[] = [];
  if (!cliente) faltantes.push('Selecciona un cliente existente.');
  if (!empleado?.activo || !empleado.esAgendable) faltantes.push('Selecciona un profesional disponible.');
  if (!payload.servicios.length) faltantes.push('Indica el servicio o los servicios.');
  if (!payload.fecha) faltantes.push('Indica la fecha.');
  if (!payload.hora) faltantes.push('Indica la hora, incluyendo mañana o tarde.');
  if (payload.empleadoId) scopedEmployee(user, payload.empleadoId);
  if (payload.fecha && payload.hora) {
    try { requireFutureTime(payload.fecha, payload.hora); }
    catch (error) { if (error instanceof AssistantError) faltantes.push(error.message); else throw error; }
  }
  if (payload.empleadoId && empleado?.activo && empleado.esAgendable && payload.fecha && payload.hora && payload.servicios.length && !faltantes.length) {
    const availability = await calculateAppointmentAvailability(payload.empleadoId, payload.fecha, payload.servicios[0].id, payload.servicios.reduce((sum, service) => sum + service.duracion, 0), payload.hora, null, false, db);
    if (!availability.disponible || !availability.bloques.some(slot => slot.hora === payload.hora && slot.disponible)) {
      faltantes.push('Ese horario no está disponible dentro de la jornada. Pide otro horario o consulta la disponibilidad.');
    }
  }
  return { ...payload, id, revision, expiresAt: expiresAt.toISOString(), clienteNombre: cliente?.nombre ?? null, profesionalNombre: empleado?.nombre ?? null, listo: faltantes.length === 0, faltantes };
}

export async function chat(user: AssistantUser, input: z.infer<typeof ChatInputSchema>): Promise<AssistantReply> {
  const { servicios, empleados } = await assistantCatalog(user);
  const previous = input.borradorId ? await prisma.iaBorrador.findFirst({ where: { id: input.borradorId, userId: user.id } }) : null;
  if (input.borradorId && (!previous || previous.estado !== 'BORRADOR' || previous.expiresAt <= new Date())) throw new AssistantError('El borrador venció o ya fue confirmado. Inicia una nueva cita.', 409);
  if (previous && input.revision !== previous.revision) throw new AssistantError('El borrador cambió en otra solicitud. Inicia una nueva cita.', 409);
  const safe = prepareSafeCommand(input.mensaje, servicios, empleados);
  if (!safe.ok) return { text: 'Para cuidar los datos del cliente, utiliza el selector en pantalla y dicta solo la operación, los servicios, el profesional y el horario. No envíes nombres de clientes, teléfonos ni notas. También puedes utilizar los ejemplos y selectores de esta página.', mode: 'local', fallbackReason: 'privacy' };
  const today = getBusinessTodayString();
  const local = parseLocalCommand(safe.text, today, Boolean(previous));
  const interpreted = await interpretCommand(safe.text, today, local, user.id);
  const intent = interpreted.intent;
  const base = { mode: interpreted.mode, ...(interpreted.fallbackReason ? { fallbackReason: interpreted.fallbackReason } : {}) };
  if (!validIntentDate(intent.fecha)) return { ...base, text: 'Esa fecha no existe. Indica un día válido, por ejemplo 2026-11-20.' };
  const serviceRefs = [...new Set(intent.servicios ?? [])];
  const chosenServices = serviceRefs.map(ref => servicios[Number(ref.slice(1))]);
  const spokenEmployee = intent.profesional ? empleados[Number(intent.profesional.slice(1))] : null;
  if (chosenServices.some(service => !service) || (intent.profesional && !spokenEmployee)) return { ...base, text: 'No pude identificar el servicio o el profesional. Utiliza los nombres que aparecen en pantalla.' };
  const employeeId = scopedEmployee(user, spokenEmployee?.id ?? input.empleadoId);
  const fecha = intent.fecha || today;

  if (intent.accion === 'ayuda') return { ...base, text: help };
  if (intent.accion === 'agenda' || intent.accion === 'resumen') {
    let from = fecha;
    let to = fecha;
    if (intent.periodo === 'semana') {
      const day = new Date(`${fecha}T12:00:00Z`).getUTCDay();
      from = addDays(fecha, -(day === 0 ? 6 : day - 1)); to = addDays(from, 6);
    } else if (intent.periodo === 'mes') {
      from = `${fecha.slice(0, 7)}-01`;
      const next = new Date(`${from}T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
      to = addDays(next.toISOString().slice(0, 10), -1);
    }
    const where = { fecha: { gte: parseLocalDateToUTC(from), lte: parseLocalDateToUTC(to) }, ...(employeeId ? { empleado_id: employeeId } : {}) };
    if (intent.accion === 'resumen') {
      const groups = await prisma.cita.groupBy({ by: ['estado'], where, _count: { _all: true } });
      const resumen: Record<string, number> = {};
      for (const group of groups) resumen[group.estado] = group._count._all;
      return { ...base, text: `Resumen del ${from} al ${to}. Datos actuales de ${user.rol === 'EMPLEADO' ? 'tu agenda' : 'la agenda seleccionada'}.`, resumen };
    }
    const [rows, total] = await Promise.all([
      prisma.cita.findMany({ where, select: { id: true, cliente_nombre: true, fecha: true, hora: true, estado: true, empleado: { select: { nombre: true } }, citaServicios: { select: { servicio: { select: { nombre: true } } }, orderBy: { orden: 'asc' } }, servicio: { select: { nombre: true } } }, orderBy: [{ fecha: 'asc' }, { hora: 'asc' }], take: 30 }),
      prisma.cita.count({ where }),
    ]);
    return { ...base, text: total ? `Del ${from} al ${to}: ${total} citas. Mostrando ${rows.length}${total > rows.length ? '; consulta el resto en Agenda' : ''}.` : `No hay citas del ${from} al ${to}.`, agenda: rows.map((row: { id: string; cliente_nombre: string; empleado: { nombre: string }; citaServicios: { servicio: { nombre: string } }[]; servicio: { nombre: string }; fecha: Date; hora: string; estado: string }) => ({ id: row.id, cliente: row.cliente_nombre, profesional: row.empleado.nombre, servicios: row.citaServicios.map(item => item.servicio.nombre).join(', ') || row.servicio.nombre, fecha: row.fecha.toISOString().slice(0, 10), hora: row.hora, estado: row.estado })) };
  }

  const old = previous ? DraftPayloadSchema.parse(previous.payload) : null;
  const payload: DraftPayload = {
    clienteId: input.clienteId !== undefined ? input.clienteId : old?.clienteId ?? null,
    empleadoId: spokenEmployee?.id ?? (user.rol === 'EMPLEADO' ? user.id : input.empleadoId !== undefined ? input.empleadoId : old?.empleadoId ?? null),
    servicios: chosenServices.length ? chosenServices : old?.servicios ?? [],
    fecha: intent.fecha || old?.fecha || null,
    hora: intent.horaAmbigua ? null : intent.hora || old?.hora || null,
  };
  if (intent.accion === 'disponibilidad') {
    if (!payload.empleadoId) return { ...base, text: 'Selecciona un profesional para consultar sus horarios disponibles.' };
    if (!payload.servicios.length) return { ...base, text: 'Indica el servicio para calcular el tiempo necesario, por ejemplo: «Horarios disponibles de corte mañana».' };
    const requestedDate = intent.fecha || old?.fecha || fecha;
    if (requestedDate < today) return { ...base, text: 'Para buscar disponibilidad, elige hoy o una fecha futura.' };
    const availability = await calculateAppointmentAvailability(payload.empleadoId, requestedDate, payload.servicios[0].id, payload.servicios.reduce((sum, service) => sum + service.duracion, 0), null, null, false);
    const horarios = availability.bloques.filter(slot => slot.disponible && (requestedDate !== today || slot.hora > getBusinessNowTime())).map(slot => slot.hora);
    return { ...base, text: horarios.length ? `Horarios disponibles el ${requestedDate}. Indica uno para preparar la cita; se comprobará otra vez al confirmar.` : `No hay horarios disponibles el ${requestedDate} para esos servicios.`, horarios,
      horarioContexto: { fecha: requestedDate, servicios: payload.servicios.map(service => service.nombre), empleadoId: payload.empleadoId } };
  }
  if (payload.empleadoId) scopedEmployee(user, payload.empleadoId);
  if (payload.clienteId && !await prisma.cliente.findUnique({ where: { id: payload.clienteId }, select: { id: true } })) throw new AssistantError('El cliente ya no existe. Selecciónalo de nuevo.');
  const expiresAt = new Date(Date.now() + 15 * 60000);
  let id: string;
  let revision: number;
  if (previous) {
    const updated = await prisma.iaBorrador.updateMany({ where: { id: previous.id, userId: user.id, revision: previous.revision, estado: 'BORRADOR', expiresAt: { gt: new Date() } }, data: { payload: payload as unknown as Prisma.InputJsonValue, revision: { increment: 1 }, expiresAt } });
    if (updated.count !== 1) throw new AssistantError('El borrador cambió mientras se procesaba la solicitud. Inicia una nueva cita.', 409);
    id = previous.id; revision = previous.revision + 1;
  } else {
    const created = await prisma.iaBorrador.create({ data: { userId: user.id, payload: payload as unknown as Prisma.InputJsonValue, expiresAt } });
    id = created.id; revision = created.revision;
  }
  const draft = await draftView(id, revision, expiresAt, payload, user);
  await logAudit({ action: 'IA_DRAFT_PREPARED', module: 'IA', status: 'SUCCESS', userId: user.id, userRole: user.rol, entityType: 'IaBorrador', entityId: id, metadata: { mode: base.mode, revision } });
  return { ...base, text: draft.listo ? 'La cita está preparada. Revisa el resumen y pulsa «Confirmar cita» para registrarla.' : `Borrador preparado. ${draft.faltantes.join(' ')}`, draft };
}

export async function confirmDraft(user: AssistantUser, id: string, revision: number) {
  const result = await prisma.$transaction(async (tx: Db) => {
    await tx.$queryRaw`SELECT "id" FROM "IaBorrador" WHERE "id" = ${id} AND "userId" = ${user.id} FOR UPDATE`;
    const draft = await tx.iaBorrador.findFirst({ where: { id, userId: user.id } });
    if (!draft) throw new AssistantError('Borrador no encontrado.', 404);
    if (draft.revision !== revision) throw new AssistantError('El resumen cambió. Revisa la versión más reciente antes de confirmar.', 409);
    if (draft.estado === 'CONFIRMADO' && draft.citaId) return { citaId: draft.citaId, replay: true };
    if (draft.estado !== 'BORRADOR' || draft.expiresAt <= new Date()) throw new AssistantError('El borrador venció. Prepara la cita de nuevo.', 409);
    const payload = DraftPayloadSchema.parse(draft.payload);
    const { clienteId, empleadoId, fecha, hora } = payload;
    if (!clienteId || !empleadoId || !fecha || !hora || !payload.servicios.length) throw new AssistantError('Completa el borrador antes de confirmar.');
    scopedEmployee(user, empleadoId);
    requireFutureTime(fecha, hora);
    const [cliente, empleado, services] = await Promise.all([
      tx.cliente.findUnique({ where: { id: clienteId }, select: { nombre: true, telefono: true } }),
      tx.empleado.findUnique({ where: { id: empleadoId }, select: { activo: true, esAgendable: true } }),
      tx.servicio.findMany({ where: { id: { in: payload.servicios.map(service => service.id) }, activo: true }, select: { id: true, nombre: true, duracion: true } }),
    ]);
    if (!cliente || !empleado?.activo || !empleado.esAgendable || services.length !== payload.servicios.length) throw new AssistantError('El cliente, profesional o servicio ya no está disponible. Prepara la cita nuevamente.', 409);
    const refreshed = payload.servicios.map(service => services.find(current => current.id === service.id)!);
    if (refreshed.some((service, index) => service.duracion !== payload.servicios[index].duracion || service.nombre !== payload.servicios[index].nombre)) {
      payload.servicios = refreshed;
      const updated = await tx.iaBorrador.update({ where: { id }, data: { payload: payload as unknown as Prisma.InputJsonValue, revision: { increment: 1 } } });
      return { changed: true, draft: await draftView(id, updated.revision, updated.expiresAt, payload, user, tx) };
    }
    const created = await createAppointmentInTransaction(tx, {
      finalEmpleadoId: empleadoId, fecha, hora, primerServicioId: refreshed[0].id,
      duracionCalculada: refreshed.reduce((sum, service) => sum + service.duracion, 0), serviciosParaCita: refreshed,
      permitirHorarioExtendido: false, allowOverlap: false, userRole: user.rol, userId: user.id,
      idClienteFinal: clienteId, finalClienteNombre: cliente.nombre, finalClienteTelefono: cliente.telefono,
    });
    if ('error' in created || 'type' in created) throw new AssistantError('El horario dejó de estar disponible. Consulta horarios y modifica el borrador antes de confirmar.', 409);
    await tx.iaBorrador.update({ where: { id }, data: { estado: 'CONFIRMADO', citaId: created.cita.id } });
    return { citaId: created.cita.id, replay: false };
  }, { timeout: 15000 });
  if ('changed' in result) return { status: 409, body: { error: 'Cambió el servicio o su duración. Revisa el resumen actualizado y confirma de nuevo.', draft: result.draft } };
  if (!result.replay) await logAudit({ action: 'APPOINTMENT_CREATED', module: 'CITAS', status: 'SUCCESS', userId: user.id, userRole: user.rol, entityType: 'Cita', entityId: result.citaId, description: 'Cita registrada desde el asistente con confirmación en pantalla.', metadata: { origin: 'IA', draftId: id } });
  return { status: result.replay ? 200 : 201, body: { citaId: result.citaId, mensaje: 'Cita registrada correctamente.', replay: result.replay } };
}
