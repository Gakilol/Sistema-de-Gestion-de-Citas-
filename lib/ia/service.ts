import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  getBusinessNowTime,
  getBusinessTodayString,
  isValidBusinessDateString,
  parseLocalDateToUTC,
} from '@/lib/timezone';
import { formatTime12Hour } from '@/lib/time-utils';
import { calculateAppointmentAvailability } from '@/lib/appointments/appointment-availability';
import { createAppointmentInTransaction } from '@/lib/appointments/create-appointment';
import {
  cancelAppointmentInTransaction,
  rescheduleAppointmentInTransaction,
} from '@/lib/appointments/mutate-appointment';
import { logAudit } from '@/lib/audit/audit-logger';
import { resolveClientDirectory, type ClientDirectoryMatch } from '@/lib/clients/client-search';
import { normalizeClientPhone, normalizeClientText } from '@/lib/clients/client-normalization';
import { buildClientDirectoryResponse } from '@/lib/client-privacy';
import { AssistantError, scopedEmployee, type AssistantUser } from './access';
import {
  DraftPayloadSchema,
  type AgendaRow,
  type AppointmentCandidate,
  type AssistantIntent,
  type AssistantReply,
  type ChatInputSchema,
  type ClientCandidate,
  type DraftOperation,
  type DraftPayload,
  type DraftView,
  type EmployeeOption,
  type OfferedSlot,
  type ServiceOption,
  type TimeOfDayWindow,
} from './domain';
import {
  addDays,
  extractLocalEntitiesAndSanitize,
  parseLocalCommand,
  validIntentDate,
} from './intent';
import { interpretCommand } from './provider';
import { checkSpecificSlot, findRealSlotOptions, timeWindowLabel } from './availability';
import {
  formatAgendaSpoken,
  formatAppointmentCandidatesReply,
  formatClientCandidatesReply,
  formatDateSpanish,
  formatServiceCandidatesReply,
  formatSlotListSpoken,
  formatSlotListText,
  formatTimeSpoken,
  formatWindowLabel,
} from './speech-format';

type Db = Prisma.TransactionClient;

const HELP_TEXT =
  'Puedes hablar o escribir naturalmente, por ejemplo: «Agenda a Ana López para corte el viernes por la tarde», «¿Qué citas tiene Ana López?», «Horarios disponibles mañana por la tarde», «Reprograma la cita de Ana López para el sábado» o «Cancela la cita de Ana López».';
const HELP_SPOKEN =
  'Puedes pedirme agendar, reprogramar o cancelar citas, o consultar horarios y citas existentes. Por ejemplo, di: agenda a Ana López para corte el viernes por la tarde.';

const PRIVACY_REJECT_TEXT =
  'No pude procesar esa solicitud porque contiene información fuera de las operaciones permitidas. Indica solo la acción, el cliente, el servicio, el profesional y el horario.';
const PRIVACY_REJECT_SPOKEN =
  'No pude procesar esa solicitud. Indica solo la acción, el cliente, el servicio y el horario.';

export async function assistantCatalog(user: AssistantUser, db: Db = prisma) {
  const [servicios, empleados] = await Promise.all([
    db.servicio.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, duracion: true },
      orderBy: { nombre: 'asc' },
      take: 200,
    }),
    db.empleado.findMany({
      where: { activo: true, esAgendable: true, ...(user.rol === 'EMPLEADO' ? { id: user.id } : {}) },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
      take: 100,
    }),
  ]);
  return { servicios, empleados };
}

export function requireFutureTime(fecha: string, hora: string) {
  if (!isValidBusinessDateString(fecha) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    throw new AssistantError('La fecha o la hora no es válida.');
  }
  const today = getBusinessTodayString();
  if (fecha < today || (fecha === today && hora <= getBusinessNowTime())) {
    throw new AssistantError('Elige una fecha y hora futuras para la cita.');
  }
}

function buildMinimalClientHint(client: ClientDirectoryMatch, role: AssistantUser['rol']): string | null {
  const safe = buildClientDirectoryResponse(client, role);
  const digits = normalizeClientPhone(safe.telefono);
  if (digits.length >= 4) {
    return `tel. ···${digits.slice(-4)}`;
  }
  if (safe.correo) {
    const [local, domain] = safe.correo.split('@');
    if (domain) return `${local.slice(0, 1)}***@${domain}`;
  }
  return null;
}

function toClientCandidate(client: ClientDirectoryMatch, role: AssistantUser['rol']): ClientCandidate {
  return {
    id: client.id,
    nombre: client.nombre,
    pista: buildMinimalClientHint(client, role),
  };
}

async function resolveClientHintAgainstCandidates(
  candidates: ClientCandidate[],
  hint: string,
  db: Db = prisma,
): Promise<ClientCandidate | null> {
  const digits = normalizeClientPhone(hint);
  const normalizedHint = normalizeClientText(hint);

  // First try direct hint match
  const byPista = candidates.filter(candidate => {
    const pista = normalizeClientText(candidate.pista);
    if (digits.length >= 3 && pista.includes(digits)) return true;
    if (normalizedHint && pista.includes(normalizedHint)) return true;
    return false;
  });
  if (byPista.length === 1) return byPista[0];

  // Fallback: check actual candidate records inside NovaCita only (never leaves NovaCita)
  const rows = await db.cliente.findMany({
    where: { id: { in: candidates.map(candidate => candidate.id) } },
    select: { id: true, nombre: true, telefono: true, correo: true },
  });
  const matched = rows.filter(row => {
    const phone = normalizeClientPhone(row.telefono);
    const email = normalizeClientText(row.correo);
    const name = normalizeClientText(row.nombre);
    return (
      (digits.length >= 3 && (phone.endsWith(digits) || phone.includes(digits)))
      || (normalizedHint.length >= 2 && (email.includes(normalizedHint) || name.includes(normalizedHint)))
    );
  });
  if (matched.length === 1) {
    return candidates.find(candidate => candidate.id === matched[0].id) ?? null;
  }
  return null;
}

async function findEditableClientAppointments(
  user: AssistantUser,
  clienteId: string,
  dateFilter?: string | null,
  db: Db = prisma,
): Promise<AppointmentCandidate[]> {
  const today = getBusinessTodayString();
  const where: Prisma.CitaWhereInput = {
    cliente_id: clienteId,
    estado: { notIn: ['COMPLETADA', 'CANCELADA', 'NO_SHOW'] },
    ...(user.rol === 'EMPLEADO' ? { empleado_id: user.id } : {}),
    ...(dateFilter ? { fecha: parseLocalDateToUTC(dateFilter) } : { fecha: { gte: parseLocalDateToUTC(today) } }),
  };

  let rows = await db.cita.findMany({
    where,
    select: {
      id: true,
      cliente_id: true,
      cliente_nombre: true,
      empleado_id: true,
      fecha: true,
      hora: true,
      duracion: true,
      estado: true,
      updated_at: true,
      empleado: { select: { nombre: true } },
      servicio: { select: { id: true, nombre: true, duracion: true } },
      citaServicios: {
        select: { duracion: true, servicio: { select: { id: true, nombre: true, duracion: true } } },
        orderBy: { orden: 'asc' },
      },
    },
    orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
    take: 8,
  });

  // If no upcoming appointments found without dateFilter, check any active non-terminal appointment
  if (!rows.length && !dateFilter) {
    rows = await db.cita.findMany({
      where: {
        cliente_id: clienteId,
        estado: { notIn: ['COMPLETADA', 'CANCELADA', 'NO_SHOW'] },
        ...(user.rol === 'EMPLEADO' ? { empleado_id: user.id } : {}),
      },
      select: {
        id: true,
        cliente_id: true,
        cliente_nombre: true,
        empleado_id: true,
        fecha: true,
        hora: true,
        duracion: true,
        estado: true,
        updated_at: true,
        empleado: { select: { nombre: true } },
        servicio: { select: { id: true, nombre: true, duracion: true } },
        citaServicios: {
          select: { duracion: true, servicio: { select: { id: true, nombre: true, duracion: true } } },
          orderBy: { orden: 'asc' },
        },
      },
      orderBy: [{ fecha: 'desc' }, { hora: 'asc' }],
      take: 8,
    });
  }

  return rows.map(row => {
    const services: ServiceOption[] = row.citaServicios.length
      ? row.citaServicios.map(item => ({
          id: item.servicio.id,
          nombre: item.servicio.nombre,
          duracion: item.duracion || item.servicio.duracion,
        }))
      : [{ id: row.servicio.id, nombre: row.servicio.nombre, duracion: row.duracion || row.servicio.duracion }];

    return {
      id: row.id,
      clienteId: row.cliente_id,
      clienteNombre: row.cliente_nombre,
      empleadoId: row.empleado_id,
      profesionalNombre: row.empleado.nombre,
      servicios: services,
      fecha: row.fecha.toISOString().slice(0, 10),
      hora: row.hora,
      estado: row.estado,
      updatedAt: row.updated_at.toISOString(),
    };
  });
}

async function draftView(
  id: string,
  revision: number,
  expiresAt: Date,
  payload: DraftPayload,
  user: AssistantUser,
  db: Db = prisma,
): Promise<DraftView> {
  const operacion: DraftOperation = payload.operacion ?? 'crear';
  const [cliente, empleado] = await Promise.all([
    payload.clienteId
      ? db.cliente.findUnique({ where: { id: payload.clienteId }, select: { nombre: true } })
      : null,
    payload.empleadoId
      ? db.empleado.findUnique({ where: { id: payload.empleadoId }, select: { nombre: true, activo: true, esAgendable: true } })
      : null,
  ]);

  const faltantes: string[] = [];

  if (operacion === 'cancelar') {
    if (!payload.citaObjetivoId) faltantes.push('Indica qué cita deseas cancelar.');
    if (payload.empleadoId) scopedEmployee(user, payload.empleadoId);
  } else {
    if (operacion === 'reprogramar' && !payload.citaObjetivoId) {
      faltantes.push('Indica qué cita deseas reprogramar.');
    }
    if (operacion === 'crear' && !cliente) {
      faltantes.push('Indica el cliente para la cita.');
    }
    if (!payload.servicios.length) {
      faltantes.push('Indica el servicio o los servicios.');
    }
    if (!payload.fecha) {
      faltantes.push('Indica la fecha.');
    }
    if (!payload.hora) {
      faltantes.push('Indica o elige la hora.');
    }
    if (!empleado?.activo || !empleado.esAgendable) {
      faltantes.push('Indica un profesional disponible.');
    }
    if (payload.empleadoId) scopedEmployee(user, payload.empleadoId);
    if (payload.fecha && payload.hora) {
      try {
        requireFutureTime(payload.fecha, payload.hora);
      } catch (error) {
        if (error instanceof AssistantError) faltantes.push(error.message);
        else throw error;
      }
    }
    if (
      payload.empleadoId
      && empleado?.activo
      && empleado.esAgendable
      && payload.fecha
      && payload.hora
      && payload.servicios.length
      && !faltantes.length
    ) {
      const availability = await calculateAppointmentAvailability(
        payload.empleadoId,
        payload.fecha,
        payload.servicios[0].id,
        payload.servicios.reduce((sum, service) => sum + service.duracion, 0),
        payload.hora,
        operacion === 'reprogramar' ? payload.citaObjetivoId ?? null : null,
        false,
        db,
      );
      if (!availability.disponible || !availability.bloques.some(slot => slot.hora === payload.hora && slot.disponible)) {
        faltantes.push('Ese horario no está disponible dentro de la jornada. Elige otro horario.');
      }
    }
  }

  return {
    ...payload,
    operacion,
    id,
    revision,
    expiresAt: expiresAt.toISOString(),
    clienteNombre: cliente?.nombre ?? payload.citaObjetivoResumen?.clienteNombre ?? null,
    profesionalNombre: empleado?.nombre ?? payload.citaObjetivoResumen?.profesionalNombre ?? null,
    listo: faltantes.length === 0,
    faltantes,
  };
}

async function persistDraft(
  user: AssistantUser,
  previous: { id: string; revision: number } | null,
  payload: DraftPayload,
) {
  const expiresAt = new Date(Date.now() + 15 * 60000);
  let id: string;
  let revision: number;
  if (previous) {
    const updated = await prisma.iaBorrador.updateMany({
      where: {
        id: previous.id,
        userId: user.id,
        revision: previous.revision,
        estado: 'BORRADOR',
        expiresAt: { gt: new Date() },
      },
      data: {
        payload: payload as unknown as Prisma.InputJsonValue,
        revision: { increment: 1 },
        expiresAt,
      },
    });
    if (updated.count !== 1) {
      throw new AssistantError('El borrador cambió mientras se procesaba la solicitud. Intenta nuevamente.', 409);
    }
    id = previous.id;
    revision = previous.revision + 1;
  } else {
    const created = await prisma.iaBorrador.create({
      data: {
        userId: user.id,
        payload: payload as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });
    id = created.id;
    revision = created.revision;
  }
  const draft = await draftView(id, revision, expiresAt, payload, user);
  await logAudit({
    action: 'IA_DRAFT_PREPARED',
    module: 'IA',
    status: 'SUCCESS',
    userId: user.id,
    userRole: user.rol,
    entityType: 'IaBorrador',
    entityId: id,
    metadata: { revision, operacion: payload.operacion ?? 'crear' },
  });
  return draft;
}

function shouldUseGemini(safeText: string, local: AssistantIntent): boolean {
  if (safeText === 'c0') return false;
  if (local.accion === 'confirmar_resumen' || local.accion === 'descartar') return false;
  if (
    (local.opcionIndice !== undefined || local.seleccionUltima)
    && !local.fecha
    && !local.hora
    && !local.servicios?.length
    && !local.tieneCliente
  ) {
    return false;
  }
  return true;
}

function buildReadySummaryMessages(draft: DraftView, confirmPrompted = false) {
  const serviceNames = draft.servicios.map(service => service.nombre).join(' + ');
  const dateText = draft.fecha ? formatDateSpanish(draft.fecha) : '';
  const timeText = draft.hora ? formatTime12Hour(draft.hora) : '';
  const spokenTime = draft.hora ? formatTimeSpoken(draft.hora) : '';
  const empText = draft.profesionalNombre ? ` con ${draft.profesionalNombre}` : '';

  if (draft.operacion === 'cancelar' && draft.citaObjetivoResumen) {
    const target = draft.citaObjetivoResumen;
    const targetDate = formatDateSpanish(target.fecha);
    const prefix = confirmPrompted
      ? 'Aquí tienes el resumen pendiente de cancelación.'
      : 'Preparé la cancelación de la cita.';
    const text = `${prefix} ${target.clienteNombre} · ${target.servicios} el ${targetDate} a las ${formatTime12Hour(target.hora)} con ${target.profesionalNombre}. Revisa el resumen y pulsa «Confirmar cancelación» en pantalla.`;
    const spokenText = confirmPrompted
      ? `El resumen para cancelar la cita de ${target.clienteNombre} del ${targetDate} a las ${formatTimeSpoken(target.hora)} está listo en pantalla. Por seguridad, pulsa Confirmar cancelación.`
      : `Preparé la cancelación de la cita de ${target.clienteNombre} del ${targetDate} a las ${formatTimeSpoken(target.hora)}. Revisa el resumen y pulsa Confirmar cancelación en pantalla.`;
    return { text, spokenText };
  }

  if (draft.operacion === 'reprogramar' && draft.citaObjetivoResumen) {
    const target = draft.citaObjetivoResumen;
    const oldDate = formatDateSpanish(target.fecha);
    const prefix = confirmPrompted
      ? 'Aquí tienes el resumen pendiente de reprogramación.'
      : 'Listo, preparé la reprogramación.';
    const text = `${prefix} ${target.clienteNombre} (${serviceNames}): de ${oldDate} ${formatTime12Hour(target.hora)} al ${dateText} a las ${timeText}${empText}. Pulsa «Confirmar reprogramación» en pantalla para aplicar el cambio.`;
    const spokenText = confirmPrompted
      ? `El resumen de reprogramación para ${target.clienteNombre} el ${dateText} a las ${spokenTime}${empText} está en pantalla. Por seguridad, pulsa Confirmar reprogramación.`
      : `Listo. Preparé la reprogramación de ${target.clienteNombre} para el ${dateText} a las ${spokenTime}${empText}. Revisa el resumen y pulsa Confirmar reprogramación en pantalla.`;
    return { text, spokenText };
  }

  const prefix = confirmPrompted
    ? 'Aquí tienes el resumen pendiente listo para confirmar:'
    : 'Listo, preparé la cita:';
  const text = `${prefix} ${draft.clienteNombre} · ${serviceNames} el ${dateText} a las ${timeText}${empText}. Por seguridad, revisa el resumen y pulsa «Confirmar cita» en pantalla para registrarla.`;
  const spokenText = confirmPrompted
    ? `El resumen de la cita de ${draft.clienteNombre} para ${serviceNames} el ${dateText} a las ${spokenTime}${empText} está en pantalla. Por seguridad, pulsa el botón Confirmar cita.`
    : `Listo. Preparé la cita de ${draft.clienteNombre} para ${serviceNames} el ${dateText} a las ${spokenTime}${empText}. Revisa el resumen y pulsa Confirmar cita en pantalla.`;
  return { text, spokenText };
}

function buildSlotOfferMessages(params: {
  clienteNombre?: string | null;
  serviceNames: string;
  requestedFecha: string;
  franja?: TimeOfDayWindow | null;
  status: 'exact_window' | 'exact_day' | 'same_day_other_window' | 'next_days' | 'none';
  options: OfferedSlot[];
  leadReason?: string;
  actionWord?: string;
}) {
  const { clienteNombre, serviceNames, requestedFecha, franja, status, options, leadReason, actionWord = 'agendar' } = params;
  const dateLabel = formatDateSpanish(requestedFecha);
  const windowLabel = formatWindowLabel(franja);
  const clientLead = clienteNombre ? `para ${clienteNombre} ` : '';
  const showDatePerSlot = status === 'next_days' || new Set(options.map(slot => slot.fecha)).size > 1;

  if (!options.length || status === 'none') {
    const text = `${leadReason ? `${leadReason} ` : ''}No encontré horarios disponibles para ${serviceNames} el ${dateLabel}${windowLabel ? ` ${windowLabel}` : ''} ni en los próximos días. ¿Quieres probar con otra fecha o servicio?`;
    return { text, spokenText: text };
  }

  let introText: string;
  let introSpoken: string;

  if (leadReason) {
    introText = `${leadReason} Estas son las opciones disponibles ${clientLead}para ${serviceNames}:`;
    introSpoken = `${leadReason} Tengo estas opciones para ${serviceNames}:`;
  } else if (status === 'same_day_other_window') {
    introText = `El ${dateLabel} no hay espacio ${windowLabel} para ${serviceNames}, pero sí tengo disponibilidad en otro horario ese mismo día:`;
    introSpoken = `El ${dateLabel} no hay cupo ${windowLabel} para ${serviceNames}, pero sí en otro horario ese día:`;
  } else if (status === 'next_days') {
    introText = `No hay cupo el ${dateLabel}${windowLabel ? ` ${windowLabel}` : ''} para ${serviceNames}. Estas son las próximas opciones reales disponibles:`;
    introSpoken = `No hay cupo el ${dateLabel} para ${serviceNames}. Te ofrezco las próximas opciones disponibles:`;
  } else {
    introText = `Tengo estos horarios disponibles ${clientLead}para ${serviceNames} el ${dateLabel}${windowLabel ? ` ${windowLabel}` : ''}:`;
    introSpoken = `Para ${clienteNombre ? `${clienteNombre}, ` : ''}${serviceNames} el ${dateLabel}${windowLabel ? ` ${windowLabel}` : ''}, tengo estas opciones:`;
  }

  const listText = formatSlotListText(options, showDatePerSlot);
  const listSpoken = formatSlotListSpoken(options, showDatePerSlot);
  const tailText = `¿Cuál prefieres para ${actionWord}? Puedes decir «la primera», «la segunda», otra hora o cambiar de día.`;
  const tailSpoken = '¿Cuál prefieres?';

  return {
    text: `${introText}\n${listText}\n${tailText}`,
    spokenText: `${introSpoken} ${listSpoken} ${tailSpoken}`,
  };
}

export async function chat(user: AssistantUser, input: z.infer<typeof ChatInputSchema>): Promise<AssistantReply> {
  const { servicios, empleados } = await assistantCatalog(user);
  const previous = input.borradorId
    ? await prisma.iaBorrador.findFirst({ where: { id: input.borradorId, userId: user.id } })
    : null;

  if (input.borradorId && (!previous || previous.estado !== 'BORRADOR' || previous.expiresAt <= new Date())) {
    throw new AssistantError('El borrador venció o ya fue confirmado. Inicia una nueva solicitud.', 409);
  }
  if (previous && input.revision !== previous.revision) {
    throw new AssistantError('El borrador cambió en otra solicitud. Intenta de nuevo.', 409);
  }

  const old = previous ? DraftPayloadSchema.parse(previous.payload) : null;
  const activeOperation: DraftOperation | null = old ? (old.operacion ?? 'crear') : null;
  const pendingField = old?.pendiente ?? null;

  // Step 1: Local privacy firewall & entity extraction INSIDE NovaCita (ZERO PII ever sent to Gemini)
  const extracted = extractLocalEntitiesAndSanitize(input.mensaje, servicios, empleados, {
    pendingField,
    hasClientCandidates: Boolean(old?.clientesCandidatos?.length),
  });

  if (extracted.blocked || !extracted.ok || !extracted.safeText) {
    return {
      text: PRIVACY_REJECT_TEXT,
      spokenText: PRIVACY_REJECT_SPOKEN,
      mode: 'local',
      fallbackReason: 'privacy',
      ...(previous && old ? { draft: await draftView(previous.id, previous.revision, previous.expiresAt, old, user) } : {}),
    };
  }

  // Step 2: Parse reduced allowlisted command locally + optionally refine with Gemini (ZERO PII)
  const today = getBusinessTodayString();
  const local = parseLocalCommand(extracted.safeText, today, Boolean(previous), {
    hasDraft: Boolean(previous),
    activeOperation,
    pendingField,
    currentDraftDate: old?.fecha ?? null,
  });

  const offeredCount =
    pendingField === 'cliente' ? (old?.clientesCandidatos?.length ?? 0)
      : pendingField === 'servicio' ? (old?.serviciosCandidatos?.length ?? 0)
        : pendingField === 'profesional' ? (old?.profesionalesCandidatos?.length ?? 0)
          : pendingField === 'cita' ? (old?.citasCandidatas?.length ?? 0)
            : (old?.horariosOfrecidos?.length ?? 0);

  const interpreted = shouldUseGemini(extracted.safeText, local)
    ? await interpretCommand(extracted.safeText, today, local, user.id, {
        hasDraft: Boolean(previous),
        activeOperation,
        pendingField,
        offeredCount,
      })
    : { intent: local, mode: 'local' as const };

  const intent = interpreted.intent;
  const base = {
    mode: interpreted.mode,
    ...(interpreted.fallbackReason ? { fallbackReason: interpreted.fallbackReason } : {}),
  };

  // Step 3: Discard draft command
  if (intent.accion === 'descartar') {
    if (previous) {
      await prisma.iaBorrador.updateMany({
        where: { id: previous.id, userId: user.id, estado: 'BORRADOR' },
        data: { estado: 'DESCARTADO' },
      });
    }
    return {
      ...base,
      text: 'Listo, descarté el borrador actual. ¿En qué te ayudo ahora?',
      spokenText: 'Listo, descarté el borrador actual. ¿En qué te ayudo?',
      draft: null,
      draftCleared: true,
    };
  }

  if (!validIntentDate(intent.fecha)) {
    return {
      ...base,
      text: 'Esa fecha no existe. Indica un día válido, por ejemplo 2026-11-20 o «el viernes».',
      spokenText: 'Esa fecha no es válida. Dime otro día, por ejemplo mañana o el viernes.',
    };
  }

  const serviceRefs = [...new Set(intent.servicios ?? [])];
  const chosenServices = serviceRefs.map(ref => servicios[Number(ref.slice(1))]);
  const spokenEmployee = intent.profesional ? empleados[Number(intent.profesional.slice(1))] : null;
  if (chosenServices.some(service => !service) || (intent.profesional && !spokenEmployee)) {
    return {
      ...base,
      text: 'No pude identificar ese servicio o profesional en el catálogo activo.',
      spokenText: 'No encontré ese servicio o profesional en el catálogo activo.',
    };
  }

  if (spokenEmployee) {
    scopedEmployee(user, spokenEmployee.id);
  }
  if (input.empleadoId) {
    scopedEmployee(user, input.empleadoId);
  }

  // Step 4: Voice confirmation signal ("sí, confirma") — NEVER mutates DB; displays/focuses pending summary
  if (intent.accion === 'confirmar_resumen') {
    if (!previous || !old) {
      return {
        ...base,
        text: 'No hay ninguna cita pendiente por confirmar. Dime qué cita deseas agendar, reprogramar o cancelar.',
        spokenText: 'No hay ninguna cita pendiente por confirmar. Dime qué cita deseas gestionar.',
      };
    }

    const op: DraftOperation = old.operacion ?? 'crear';
    const currentView = await draftView(previous.id, previous.revision, previous.expiresAt, old, user);

    if (!currentView.listo) {
      // Fall through cleanly and prompt for the single missing piece
      const nextMissing = currentView.faltantes[0] ?? 'Completa los datos pendientes antes de confirmar.';
      return {
        ...base,
        text: `Todavía falta un dato antes de confirmar: ${nextMissing}`,
        spokenText: `Todavía falta un dato: ${nextMissing}`,
        draft: currentView,
      };
    }

    // Re-check live availability right now for crear / reprogramar so we warn immediately if it just got taken
    if (op !== 'cancelar' && old.fecha && old.hora && old.servicios.length) {
      const check = await checkSpecificSlot({
        employees: empleados,
        preferredEmployeeId: old.empleadoFijado || user.rol === 'EMPLEADO' ? old.empleadoId : old.empleadoId,
        fecha: old.fecha,
        hora: old.hora,
        horaAmbigua: false,
        franja: old.franja,
        servicios: old.servicios,
        excludeCitaId: op === 'reprogramar' ? old.citaObjetivoId ?? null : null,
      });

      if (check.kind !== 'available') {
        const alternatives = check.kind === 'unavailable' || check.kind === 'past'
          ? check.alternatives
          : await findRealSlotOptions({
              employees: empleados,
              preferredEmployeeId: old.empleadoFijado || user.rol === 'EMPLEADO' ? old.empleadoId : null,
              fecha: old.fecha,
              franja: old.franja,
              servicios: old.servicios,
              excludeCitaId: op === 'reprogramar' ? old.citaObjetivoId ?? null : null,
            });

        const updatedPayload: DraftPayload = {
          ...old,
          hora: null,
          horariosOfrecidos: alternatives.options,
          pendiente: 'hora',
          confirmacionSolicitada: false,
        };
        const refreshedDraft = await persistDraft(user, previous, updatedPayload);
        const offer = buildSlotOfferMessages({
          clienteNombre: refreshedDraft.clienteNombre,
          serviceNames: old.servicios.map(s => s.nombre).join(' + '),
          requestedFecha: old.fecha,
          franja: old.franja,
          status: alternatives.status,
          options: alternatives.options,
          leadReason: `El horario de las ${formatTime12Hour(old.hora)} acaba de ocuparse.`,
          actionWord: op === 'reprogramar' ? 'reprogramar' : 'agendar',
        });
        return {
          ...base,
          text: offer.text,
          spokenText: offer.spokenText,
          draft: refreshedDraft,
          horarios: alternatives.options.map(slot => slot.hora),
          horariosOfrecidos: alternatives.options,
        };
      }
    }

    const summary = buildReadySummaryMessages(currentView, true);
    return {
      ...base,
      text: summary.text,
      spokenText: summary.spokenText,
      draft: { ...currentView, confirmacionSolicitada: true },
      highlightConfirmation: true,
    };
  }

  // Step 5: Help
  if (intent.accion === 'ayuda') {
    return { ...base, text: HELP_TEXT, spokenText: HELP_SPOKEN };
  }

  // Step 6: Agenda & Summary queries (including by client name, within RBAC permissions)
  if (intent.accion === 'agenda' || intent.accion === 'resumen') {
    const employeeId = scopedEmployee(user, spokenEmployee?.id ?? input.empleadoId);
    const fecha = intent.fecha || today;

    let resolvedClientForQuery: ClientDirectoryMatch | null = null;
    if (extracted.clientQuery) {
      const resolution = await resolveClientDirectory(extracted.clientQuery, { limit: 6 });
      if (resolution.kind === 'not_found') {
        const text = `No encontré ningún cliente llamado «${extracted.clientQuery}» en NovaCita.`;
        return { ...base, text, spokenText: text };
      }
      if (resolution.kind === 'ambiguous') {
        const candidates = resolution.clients.slice(0, 5).map(client => toClientCandidate(client, user.rol));
        const reply = formatClientCandidatesReply(extracted.clientQuery, candidates);
        return { ...base, text: reply.text, spokenText: reply.spokenText, clientesCandidatos: candidates };
      }
      resolvedClientForQuery = resolution.client;
    } else if (input.clienteId && (intent.tieneCliente || /\bcliente\b/.test(extracted.safeText))) {
      const found = await prisma.cliente.findUnique({
        where: { id: input.clienteId },
        select: { id: true, nombre: true, telefono: true, correo: true, cedula: true },
      });
      if (found) resolvedClientForQuery = found;
    }

    let from = fecha;
    let to = fecha;
    if (intent.periodo === 'semana') {
      const day = new Date(`${fecha}T12:00:00Z`).getUTCDay();
      from = addDays(fecha, -(day === 0 ? 6 : day - 1));
      to = addDays(from, 6);
    } else if (intent.periodo === 'mes') {
      from = `${fecha.slice(0, 7)}-01`;
      const next = new Date(`${from}T12:00:00Z`);
      next.setUTCMonth(next.getUTCMonth() + 1);
      to = addDays(next.toISOString().slice(0, 10), -1);
    }

    const dateWhere: Prisma.CitaWhereInput =
      resolvedClientForQuery && !intent.fecha && intent.periodo === 'dia'
        ? { fecha: { gte: parseLocalDateToUTC(today) }, estado: { notIn: ['CANCELADA'] } }
        : { fecha: { gte: parseLocalDateToUTC(from), lte: parseLocalDateToUTC(to) } };

    const where: Prisma.CitaWhereInput = {
      ...dateWhere,
      ...(employeeId ? { empleado_id: employeeId } : {}),
      ...(resolvedClientForQuery ? { cliente_id: resolvedClientForQuery.id } : {}),
    };

    if (intent.accion === 'resumen') {
      const groups = await prisma.cita.groupBy({ by: ['estado'], where, _count: { _all: true } });
      const resumen: Record<string, number> = {};
      for (const group of groups) resumen[group.estado] = group._count._all;
      const totalCount = Object.values(resumen).reduce((sum, count) => sum + count, 0);
      const text = `Resumen del ${from} al ${to}. Datos actuales de ${user.rol === 'EMPLEADO' ? 'tu agenda' : 'la agenda seleccionada'}.`;
      const spokenText = totalCount
        ? `Resumen del ${formatDateSpanish(from)} al ${formatDateSpanish(to)}: ${totalCount} citas en total.`
        : `No hay citas registradas del ${formatDateSpanish(from)} al ${formatDateSpanish(to)}.`;
      return { ...base, text, spokenText, resumen };
    }

    const [rows, total] = await Promise.all([
      prisma.cita.findMany({
        where,
        select: {
          id: true,
          cliente_nombre: true,
          fecha: true,
          hora: true,
          estado: true,
          empleado: { select: { nombre: true } },
          citaServicios: { select: { servicio: { select: { nombre: true } } }, orderBy: { orden: 'asc' } },
          servicio: { select: { nombre: true } },
        },
        orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
        take: 30,
      }),
      prisma.cita.count({ where }),
    ]);

    const agenda: AgendaRow[] = rows.map(
      (row: {
        id: string;
        cliente_nombre: string;
        empleado: { nombre: string };
        citaServicios: { servicio: { nombre: string } }[];
        servicio: { nombre: string };
        fecha: Date;
        hora: string;
        estado: string;
      }) => ({
        id: row.id,
        cliente: row.cliente_nombre,
        profesional: row.empleado.nombre,
        servicios: row.citaServicios.map(item => item.servicio.nombre).join(', ') || row.servicio.nombre,
        fecha: row.fecha.toISOString().slice(0, 10),
        hora: row.hora,
        estado: row.estado,
      }),
    );

    if (resolvedClientForQuery) {
      const header = total
        ? `${resolvedClientForQuery.nombre} tiene ${total} ${total === 1 ? 'cita' : 'citas'}${intent.fecha ? ` el ${formatDateSpanish(from)}` : ' próximas'}:`
        : `No encontré citas ${intent.fecha ? `el ${formatDateSpanish(from)} ` : 'próximas '}para ${resolvedClientForQuery.nombre}${user.rol === 'EMPLEADO' ? ' en tu agenda' : ''}.`;
      return {
        ...base,
        text: header,
        spokenText: formatAgendaSpoken(agenda, total, header),
        agenda,
      };
    }

    const rangeLabel = from === to ? `El ${formatDateSpanish(from)}` : `Del ${formatDateSpanish(from)} al ${formatDateSpanish(to)}`;
    const text = total
      ? `${from === to ? `Del ${from} al ${to}` : `Del ${from} al ${to}`}: ${total} ${total === 1 ? 'cita' : 'citas'}. Mostrando ${rows.length}${total > rows.length ? '; consulta el resto en Agenda' : ''}.`
      : `No hay citas del ${from} al ${to}.`;
    const spokenHeader = total
      ? `${rangeLabel} hay ${total} ${total === 1 ? 'cita' : 'citas'}.`
      : `${rangeLabel} no hay citas registradas.`;
    return {
      ...base,
      text,
      spokenText: formatAgendaSpoken(agenda, total, spokenHeader),
      agenda,
    };
  }

  // Step 7: Availability-only query (also saves lightweight context so "¿y el sábado?" or "la segunda" flows cleanly!)
  if (intent.accion === 'disponibilidad') {
    const requestedDate = intent.fecha || old?.fecha || today;
    if (requestedDate < today) {
      const text = 'Para buscar disponibilidad, elige hoy o una fecha futura.';
      return { ...base, text, spokenText: text };
    }
    const targetServices = chosenServices.length
      ? chosenServices
      : old?.servicios.length
        ? old.servicios
        : servicios.length === 1
          ? [servicios[0]]
          : [];

    if (!targetServices.length) {
      if (extracted.ambiguousServices?.length) {
        const reply = formatServiceCandidatesReply(extracted.ambiguousServiceTerm || 'ese servicio', extracted.ambiguousServices);
        return { ...base, text: reply.text, spokenText: reply.spokenText, serviciosCandidatos: extracted.ambiguousServices };
      }
      const text = '¿Para qué servicio quieres consultar disponibilidad? Así calculo la duración exacta.';
      return { ...base, text, spokenText: text };
    }

    const pinnedEmpId = scopedEmployee(
      user,
      intent.cualquierProfesional
        ? null
        : spokenEmployee?.id ?? (user.rol === 'EMPLEADO' ? user.id : input.empleadoId ?? (old?.empleadoFijado ? old.empleadoId : null)),
    );
    const franja = intent.franja ?? (intent.fecha && intent.fecha !== old?.fecha ? old?.franja ?? null : null);

    const found = await findRealSlotOptions({
      employees: empleados,
      preferredEmployeeId: pinnedEmpId,
      fecha: requestedDate,
      franja,
      servicios: targetServices,
      maxOptions: 6,
      searchFutureDays: true,
    });

    // Save availability context in draft so the user can immediately say "la segunda" or "¿y el sábado?"
    const nextPayload: DraftPayload = {
      clienteId: input.clienteId !== undefined ? input.clienteId : old?.clienteId ?? null,
      empleadoId: pinnedEmpId,
      empleadoFijado: Boolean(pinnedEmpId),
      servicios: targetServices,
      fecha: found.status === 'next_days' && found.options[0] ? found.options[0].fecha : requestedDate,
      hora: null,
      operacion: old?.operacion ?? 'crear',
      franja,
      citaObjetivoId: old?.citaObjetivoId ?? null,
      citaObjetivoUpdatedAt: old?.citaObjetivoUpdatedAt ?? null,
      citaObjetivoResumen: old?.citaObjetivoResumen ?? null,
      horariosOfrecidos: found.options,
      pendiente: 'hora',
      confirmacionSolicitada: false,
    };

    const draft = await persistDraft(user, previous, nextPayload);
    const offer = buildSlotOfferMessages({
      clienteNombre: draft.clienteNombre,
      serviceNames: targetServices.map(s => s.nombre).join(' + '),
      requestedFecha: requestedDate,
      franja,
      status: found.status,
      options: found.options,
    });

    return {
      ...base,
      text: offer.text,
      spokenText: offer.spokenText,
      draft,
      horarios: found.options.map(slot => slot.hora),
      horariosOfrecidos: found.options,
      horarioContexto: {
        fecha: requestedDate,
        servicios: targetServices.map(service => service.nombre),
        empleadoId: pinnedEmpId,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 8: Conversational Booking (`crear`), Reschedule (`reprogramar`), and Cancel (`cancelar`)
  // ═══════════════════════════════════════════════════════════════════════════

  const requestedOperation: DraftOperation =
    intent.accion === 'reprogramar'
      ? 'reprogramar'
      : intent.accion === 'cancelar'
        ? 'cancelar'
        : activeOperation && intent.accion === 'borrador'
          ? activeOperation
          : 'crear';

  const switchingOperation = Boolean(old && old.operacion && old.operacion !== requestedOperation);

  const nextPayload: DraftPayload = switchingOperation || !old
    ? {
        clienteId: input.clienteId !== undefined ? input.clienteId : null,
        empleadoId: user.rol === 'EMPLEADO' ? user.id : input.empleadoId ?? null,
        empleadoFijado: Boolean(user.rol === 'EMPLEADO' || input.empleadoId),
        servicios: [],
        fecha: null,
        hora: null,
        operacion: requestedOperation,
        franja: null,
        citaObjetivoId: null,
        citaObjetivoUpdatedAt: null,
        citaObjetivoResumen: null,
        horariosOfrecidos: [],
        clientesCandidatos: [],
        serviciosCandidatos: [],
        profesionalesCandidatos: [],
        citasCandidatas: [],
        pendiente: null,
        confirmacionSolicitada: false,
      }
    : {
        ...old,
        operacion: requestedOperation,
        confirmacionSolicitada: false,
      };

  // Respect explicit manual selector overrides ONLY when no conversational client was just spoken
  if (input.clienteId !== undefined && !extracted.clientQuery && !extracted.clientDisambiguationHint) {
    if (input.clienteId !== nextPayload.clienteId) {
      nextPayload.clienteId = input.clienteId;
      nextPayload.clientesCandidatos = [];
      if (requestedOperation !== 'crear') {
        nextPayload.citaObjetivoId = null;
        nextPayload.citaObjetivoResumen = null;
        nextPayload.citasCandidatas = [];
      }
    }
  }

  if (spokenEmployee) {
    nextPayload.empleadoId = scopedEmployee(user, spokenEmployee.id);
    nextPayload.empleadoFijado = true;
    nextPayload.profesionalesCandidatos = [];
  } else if (intent.cualquierProfesional) {
    if (user.rol === 'EMPLEADO') {
      nextPayload.empleadoId = user.id;
      nextPayload.empleadoFijado = true;
    } else {
      nextPayload.empleadoId = null;
      nextPayload.empleadoFijado = false;
    }
    nextPayload.profesionalesCandidatos = [];
  } else if (input.empleadoId && user.rol !== 'EMPLEADO' && !nextPayload.empleadoId) {
    nextPayload.empleadoId = scopedEmployee(user, input.empleadoId);
    nextPayload.empleadoFijado = true;
  } else if (user.rol === 'EMPLEADO') {
    nextPayload.empleadoId = user.id;
    nextPayload.empleadoFijado = true;
  }

  // ── 8A. Handle ordinal selection ("la primera", "la segunda", "la última") ──
  const hasChoiceIndex = intent.opcionIndice !== undefined || intent.seleccionUltima;
  let pickedSlotFromOption = false;

  if (hasChoiceIndex) {
    const resolveIndex = (length: number) =>
      intent.seleccionUltima ? length - 1 : (intent.opcionIndice ?? -1);

    if (pendingField === 'cliente' && nextPayload.clientesCandidatos?.length) {
      const idx = resolveIndex(nextPayload.clientesCandidatos.length);
      const chosen = nextPayload.clientesCandidatos[idx];
      if (!chosen) {
        const text = `Elige una opción entre 1 y ${nextPayload.clientesCandidatos.length}.`;
        return { ...base, text, spokenText: text, clientesCandidatos: nextPayload.clientesCandidatos };
      }
      nextPayload.clienteId = chosen.id;
      nextPayload.clientesCandidatos = [];
      nextPayload.pendiente = null;
    } else if (pendingField === 'servicio' && nextPayload.serviciosCandidatos?.length) {
      const idx = resolveIndex(nextPayload.serviciosCandidatos.length);
      const chosen = nextPayload.serviciosCandidatos[idx];
      if (!chosen) {
        const text = `Elige una opción entre 1 y ${nextPayload.serviciosCandidatos.length}.`;
        return { ...base, text, spokenText: text, serviciosCandidatos: nextPayload.serviciosCandidatos };
      }
      nextPayload.servicios = [chosen];
      nextPayload.serviciosCandidatos = [];
      nextPayload.pendiente = null;
    } else if (pendingField === 'profesional' && nextPayload.profesionalesCandidatos?.length) {
      const idx = resolveIndex(nextPayload.profesionalesCandidatos.length);
      const chosen = nextPayload.profesionalesCandidatos[idx];
      if (!chosen) {
        const text = `Elige una opción entre 1 y ${nextPayload.profesionalesCandidatos.length}.`;
        return { ...base, text, spokenText: text, profesionalesCandidatos: nextPayload.profesionalesCandidatos };
      }
      nextPayload.empleadoId = scopedEmployee(user, chosen.id);
      nextPayload.empleadoFijado = true;
      nextPayload.profesionalesCandidatos = [];
      nextPayload.pendiente = null;
    } else if (pendingField === 'cita' && nextPayload.citasCandidatas?.length) {
      const idx = resolveIndex(nextPayload.citasCandidatas.length);
      const chosen = nextPayload.citasCandidatas[idx];
      if (!chosen) {
        const text = `Elige una cita entre 1 y ${nextPayload.citasCandidatas.length}.`;
        return { ...base, text, spokenText: text, citasCandidatas: nextPayload.citasCandidatas };
      }
      applyTargetAppointment(nextPayload, chosen, user);
      nextPayload.citasCandidatas = [];
      nextPayload.pendiente = null;
    } else if (nextPayload.horariosOfrecidos?.length) {
      const idx = resolveIndex(nextPayload.horariosOfrecidos.length);
      const chosenSlot = nextPayload.horariosOfrecidos[idx];
      if (!chosenSlot) {
        const text = `Solo tengo ${nextPayload.horariosOfrecidos.length} horarios en la lista actual. Elige uno de esos o indícame otra hora.`;
        return {
          ...base,
          text,
          spokenText: text,
          horarios: nextPayload.horariosOfrecidos.map(s => s.hora),
          horariosOfrecidos: nextPayload.horariosOfrecidos,
        };
      }
      nextPayload.fecha = chosenSlot.fecha;
      nextPayload.hora = chosenSlot.hora;
      nextPayload.empleadoId = scopedEmployee(user, chosenSlot.empleadoId);
      nextPayload.horariosOfrecidos = [];
      nextPayload.pendiente = null;
      pickedSlotFromOption = true;
    }
  }

  // ── 8B. Apply spoken services, date, window, time updates while preserving other fields ──
  let serviceChanged = false;
  if (chosenServices.length) {
    nextPayload.servicios = chosenServices;
    nextPayload.serviciosCandidatos = [];
    serviceChanged = true;
  } else if (extracted.ambiguousServices?.length) {
    nextPayload.serviciosCandidatos = extracted.ambiguousServices;
  }

  if (extracted.ambiguousEmployees?.length) {
    nextPayload.profesionalesCandidatos = extracted.ambiguousEmployees;
  }

  const previousDate = nextPayload.fecha;
  const dateChanged = Boolean(intent.fecha && intent.fecha !== previousDate);
  if (intent.fecha) {
    nextPayload.fecha = intent.fecha;
  }

  const windowChanged = Boolean(intent.franja && intent.franja !== nextPayload.franja);
  if (intent.franja) {
    nextPayload.franja = intent.franja;
  }

  // If user changed the day or window WITHOUT giving a new specific time (e.g. "¿y el sábado?" or "mejor por la mañana"),
  // clear the previous slot so we re-query real availability for the new day/window!
  if ((dateChanged || windowChanged) && !intent.hora && !pickedSlotFromOption) {
    nextPayload.hora = null;
    nextPayload.horariosOfrecidos = [];
    if (!nextPayload.empleadoFijado && user.rol !== 'EMPLEADO') {
      nextPayload.empleadoId = null;
    }
  }

  let explicitTimeRequested = false;
  let requestedHora = nextPayload.hora;
  let requestedHoraAmbigua = false;
  if (intent.hora) {
    requestedHora = intent.hora;
    requestedHoraAmbigua = Boolean(intent.horaAmbigua);
    explicitTimeRequested = true;
    nextPayload.horariosOfrecidos = [];
  }

  // ── 8C. Local Client Resolution & Homonym Disambiguation (INSIDE NovaCita only!) ──
  if (extracted.clientDisambiguationHint && nextPayload.clientesCandidatos?.length) {
    const matched = await resolveClientHintAgainstCandidates(
      nextPayload.clientesCandidatos,
      extracted.clientDisambiguationHint,
    );
    if (matched) {
      nextPayload.clienteId = matched.id;
      nextPayload.clientesCandidatos = [];
      nextPayload.pendiente = null;
    } else {
      const draft = await persistDraft(user, previous, { ...nextPayload, pendiente: 'cliente' });
      const text = 'No pude distinguir cuál cliente es con ese dato. Di «la primera», «la segunda» o los últimos 4 dígitos del teléfono.';
      return {
        ...base,
        text,
        spokenText: text,
        draft,
        clientesCandidatos: nextPayload.clientesCandidatos,
      };
    }
  } else if (extracted.clientQuery) {
    const resolution = await resolveClientDirectory(extracted.clientQuery, { limit: 6 });
    if (resolution.kind === 'found') {
      if (nextPayload.clienteId !== resolution.client.id && requestedOperation !== 'crear') {
        nextPayload.citaObjetivoId = null;
        nextPayload.citaObjetivoResumen = null;
        nextPayload.citasCandidatas = [];
      }
      nextPayload.clienteId = resolution.client.id;
      nextPayload.clientesCandidatos = [];
      if (nextPayload.pendiente === 'cliente') nextPayload.pendiente = null;
    } else if (resolution.kind === 'ambiguous') {
      const candidates = resolution.clients.slice(0, 5).map(client => toClientCandidate(client, user.rol));
      nextPayload.clienteId = null;
      nextPayload.clientesCandidatos = candidates;
      nextPayload.pendiente = 'cliente';
      const draft = await persistDraft(user, previous, nextPayload);
      const reply = formatClientCandidatesReply(extracted.clientQuery, candidates);
      return {
        ...base,
        text: reply.text,
        spokenText: reply.spokenText,
        draft,
        clientesCandidatos: candidates,
      };
    } else {
      nextPayload.pendiente = 'cliente';
      const draft = await persistDraft(user, previous, nextPayload);
      const text = `No encontré a «${extracted.clientQuery}» en el directorio de clientes de NovaCita. Dime otro nombre o regístralo primero en Clientes.`;
      const spokenText = `No encontré a ${extracted.clientQuery} en el directorio de clientes. Dime otro nombre o regístralo en Clientes.`;
      return { ...base, text, spokenText, draft };
    }
  }

  // If client candidates are still unresolved, ask ONLY about the client
  if (nextPayload.clientesCandidatos?.length && !nextPayload.clienteId) {
    nextPayload.pendiente = 'cliente';
    const draft = await persistDraft(user, previous, nextPayload);
    const reply = formatClientCandidatesReply('ese nombre', nextPayload.clientesCandidatos);
    return { ...base, text: reply.text, spokenText: reply.spokenText, draft, clientesCandidatos: nextPayload.clientesCandidatos };
  }

  // Validate client still exists if present
  let clienteNombre: string | null = null;
  if (nextPayload.clienteId) {
    const foundClient = await prisma.cliente.findUnique({
      where: { id: nextPayload.clienteId },
      select: { id: true, nombre: true },
    });
    if (!foundClient) {
      throw new AssistantError('El cliente ya no existe en el directorio. Indica otro cliente.');
    }
    clienteNombre = foundClient.nombre;
  }

  // ── 8D. Disambiguate ambiguous services or employees if detected ──
  if (nextPayload.serviciosCandidatos?.length && !nextPayload.servicios.length) {
    nextPayload.pendiente = 'servicio';
    const draft = await persistDraft(user, previous, nextPayload);
    const reply = formatServiceCandidatesReply(extracted.ambiguousServiceTerm || 'servicio', nextPayload.serviciosCandidatos);
    return { ...base, text: reply.text, spokenText: reply.spokenText, draft, serviciosCandidatos: nextPayload.serviciosCandidatos };
  }

  if (nextPayload.profesionalesCandidatos?.length && !nextPayload.empleadoId) {
    nextPayload.pendiente = 'profesional';
    const draft = await persistDraft(user, previous, nextPayload);
    const lines = nextPayload.profesionalesCandidatos.map((emp, idx) => `${idx + 1}) ${emp.nombre}`).join('\n');
    const text = `Encontré varios profesionales con ese nombre:\n${lines}\n¿Con cuál prefieres agendar?`;
    const spokenText = `Encontré varios profesionales: ${nextPayload.profesionalesCandidatos.map(emp => emp.nombre).join(', ')}. ¿Con cuál prefieres?`;
    return { ...base, text, spokenText, draft, profesionalesCandidatos: nextPayload.profesionalesCandidatos };
  }

  // ── 8E. Reschedule & Cancel Target Appointment Resolution ──
  if (requestedOperation === 'reprogramar' || requestedOperation === 'cancelar') {
    if (!nextPayload.citaObjetivoId) {
      if (!nextPayload.clienteId) {
        nextPayload.pendiente = 'cliente';
        const draft = await persistDraft(user, previous, nextPayload);
        const actionVerb = requestedOperation === 'reprogramar' ? 'reprogramar' : 'cancelar';
        const text = `¿De qué cliente es la cita que quieres ${actionVerb}?`;
        return { ...base, text, spokenText: text, draft };
      }

      const candidates = await findEditableClientAppointments(
        user,
        nextPayload.clienteId,
        requestedOperation === 'cancelar' ? intent.fecha ?? null : null,
      );

      if (!candidates.length) {
        const actionVerb = requestedOperation === 'reprogramar' ? 'reprogramar' : 'cancelar';
        const text = `No encontré citas activas de ${clienteNombre} que se puedan ${actionVerb}${user.rol === 'EMPLEADO' ? ' en tu agenda' : ''}.`;
        return { ...base, text, spokenText: text };
      }

      if (candidates.length > 1) {
        nextPayload.citasCandidatas = candidates;
        nextPayload.pendiente = 'cita';
        const draft = await persistDraft(user, previous, nextPayload);
        const reply = formatAppointmentCandidatesReply(requestedOperation, clienteNombre || 'El cliente', candidates);
        return { ...base, text: reply.text, spokenText: reply.spokenText, draft, citasCandidatas: candidates };
      }

      applyTargetAppointment(nextPayload, candidates[0], user);
    }

    // For cancel: once target appointment is known, draft is ready for on-screen confirmation!
    if (requestedOperation === 'cancelar') {
      nextPayload.pendiente = 'confirmacion';
      const draft = await persistDraft(user, previous, nextPayload);
      const summary = buildReadySummaryMessages(draft, false);
      return { ...base, text: summary.text, spokenText: summary.spokenText, draft };
    }
  }

  // ── 8F. Ask ONLY for the single next missing field (for crear & reprogramar) ──
  if (requestedOperation === 'crear' && !nextPayload.clienteId) {
    nextPayload.pendiente = 'cliente';
    const draft = await persistDraft(user, previous, nextPayload);
    const text = '¿Para qué cliente es la cita?';
    return { ...base, text, spokenText: text, draft };
  }

  if (!nextPayload.servicios.length) {
    nextPayload.pendiente = 'servicio';
    const draft = await persistDraft(user, previous, nextPayload);
    const text = `¿Qué servicio deseas agendar para ${clienteNombre}?`;
    return { ...base, text, spokenText: text, draft };
  }

  if (!nextPayload.fecha) {
    nextPayload.pendiente = 'fecha';
    const draft = await persistDraft(user, previous, nextPayload);
    const serviceNames = nextPayload.servicios.map(service => service.nombre).join(' + ');
    const text = requestedOperation === 'reprogramar'
      ? `¿Para qué día quieres mover la cita de ${clienteNombre} (${serviceNames})?`
      : `¿Para qué día deseas la cita de ${serviceNames} para ${clienteNombre}?`;
    return { ...base, text, spokenText: text, draft };
  }

  if (nextPayload.fecha < today) {
    nextPayload.fecha = null;
    nextPayload.hora = null;
    nextPayload.pendiente = 'fecha';
    const draft = await persistDraft(user, previous, nextPayload);
    const text = 'Esa fecha ya pasó. ¿Para qué día futuro quieres la cita?';
    return { ...base, text, spokenText: text, draft };
  }

  // ── 8G. Check specific time OR automatically query and offer REAL available slots ──
  const excludeCitaId = requestedOperation === 'reprogramar' ? nextPayload.citaObjetivoId ?? null : null;
  const preferredEmployeeId =
    user.rol === 'EMPLEADO'
      ? user.id
      : nextPayload.empleadoFijado
        ? nextPayload.empleadoId
        : null;

  const serviceNames = nextPayload.servicios.map(service => service.nombre).join(' + ');

  if (requestedHora) {
    // Prefer keeping the currently assigned employee first if free, else check all bookable employees when not pinned
    const orderedEmployees =
      !preferredEmployeeId && nextPayload.empleadoId
        ? [
            ...empleados.filter(emp => emp.id === nextPayload.empleadoId),
            ...empleados.filter(emp => emp.id !== nextPayload.empleadoId),
          ]
        : empleados;

    const check = await checkSpecificSlot({
      employees: orderedEmployees,
      preferredEmployeeId,
      fecha: nextPayload.fecha,
      hora: requestedHora,
      horaAmbigua: requestedHoraAmbigua,
      franja: nextPayload.franja,
      servicios: nextPayload.servicios,
      excludeCitaId,
    });

    if (check.kind === 'ambiguous_ampm') {
      nextPayload.hora = null;
      nextPayload.pendiente = 'hora';
      const draft = await persistDraft(user, previous, nextPayload);
      const minStr = check.minute ? `:${String(check.minute).padStart(2, '0')}` : '';
      const text = `¿Te refieres a las ${check.hour12}${minStr} de la mañana o de la tarde?`;
      return { ...base, text, spokenText: text, draft };
    }

    if (check.kind === 'available') {
      nextPayload.hora = check.slot.hora;
      nextPayload.empleadoId = scopedEmployee(user, check.slot.empleadoId);
      nextPayload.horariosOfrecidos = [];
      nextPayload.pendiente = 'confirmacion';
      const draft = await persistDraft(user, previous, nextPayload);
      const summary = buildReadySummaryMessages(draft, false);
      return { ...base, text: summary.text, spokenText: summary.spokenText, draft };
    }

    // Specific time was past or unavailable -> clear hora and immediately offer real alternatives!
    nextPayload.hora = null;
    nextPayload.horariosOfrecidos = check.alternatives.options;
    nextPayload.pendiente = 'hora';
    const draft = await persistDraft(user, previous, nextPayload);
    const reasonLead = check.kind === 'past'
      ? `Las ${formatTime12Hour(check.resolvedHora)} del ${formatDateSpanish(nextPayload.fecha)} ya pasaron.`
      : serviceChanged && !explicitTimeRequested
        ? `Con ${serviceNames} (${nextPayload.servicios.reduce((s, x) => s + x.duracion, 0)} min), las ${formatTime12Hour(check.resolvedHora)} ya no caben disponibles.`
        : `Las ${formatTime12Hour(check.resolvedHora)} del ${formatDateSpanish(nextPayload.fecha)} no están disponibles (${check.reason}).`;

    const offer = buildSlotOfferMessages({
      clienteNombre,
      serviceNames,
      requestedFecha: nextPayload.fecha,
      franja: nextPayload.franja,
      status: check.alternatives.status,
      options: check.alternatives.options,
      leadReason: reasonLead,
      actionWord: requestedOperation === 'reprogramar' ? 'reprogramar' : 'agendar',
    });

    return {
      ...base,
      text: offer.text,
      spokenText: offer.spokenText,
      draft,
      horarios: check.alternatives.options.map(slot => slot.hora),
      horariosOfrecidos: check.alternatives.options,
    };
  }

  // No specific hour yet -> query real availability for the requested date & time-of-day window!
  const found = await findRealSlotOptions({
    employees: empleados,
    preferredEmployeeId,
    fecha: nextPayload.fecha,
    franja: nextPayload.franja,
    servicios: nextPayload.servicios,
    excludeCitaId,
    maxOptions: 5,
    searchFutureDays: true,
  });

  nextPayload.hora = null;
  nextPayload.horariosOfrecidos = found.options;
  if (found.status === 'same_day_other_window') {
    nextPayload.franja = null;
  }
  nextPayload.pendiente = 'hora';

  const draft = await persistDraft(user, previous, nextPayload);
  const offer = buildSlotOfferMessages({
    clienteNombre,
    serviceNames,
    requestedFecha: nextPayload.fecha,
    franja: nextPayload.franja,
    status: found.status,
    options: found.options,
    actionWord: requestedOperation === 'reprogramar' ? 'reprogramar' : 'agendar',
  });

  return {
    ...base,
    text: offer.text,
    spokenText: offer.spokenText,
    draft,
    horarios: found.options.map(slot => slot.hora),
    horariosOfrecidos: found.options,
  };
}

function applyTargetAppointment(payload: DraftPayload, candidate: AppointmentCandidate, user: AssistantUser) {
  payload.citaObjetivoId = candidate.id;
  payload.citaObjetivoUpdatedAt = candidate.updatedAt;
  payload.citaObjetivoResumen = {
    clienteNombre: candidate.clienteNombre,
    profesionalNombre: candidate.profesionalNombre,
    servicios: candidate.servicios.map(service => service.nombre).join(' + '),
    fecha: candidate.fecha,
    hora: candidate.hora,
    estado: candidate.estado,
  };
  payload.clienteId = candidate.clienteId;
  if (!payload.servicios.length) {
    payload.servicios = candidate.servicios;
  }
  if (!payload.empleadoFijado) {
    payload.empleadoId = user.rol === 'EMPLEADO' ? user.id : candidate.empleadoId;
    payload.empleadoFijado = true;
  }
}

async function buildConflictRecovery(
  tx: Db,
  draftId: string,
  user: AssistantUser,
  payload: DraftPayload,
  fallbackEmployee: { id: string; nombre: string },
  excludeCitaId?: string | null,
) {
  let employees: EmployeeOption[] = [fallbackEmployee];
  if (user.rol !== 'EMPLEADO' && !payload.empleadoFijado && typeof tx.empleado.findMany === 'function') {
    const activeEmployees = await tx.empleado.findMany({
      where: { activo: true, esAgendable: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
      take: 50,
    });
    if (activeEmployees.length) employees = activeEmployees;
  }

  const occupiedTime = payload.hora ? formatTime12Hour(payload.hora) : 'ese horario';
  const occupiedSpoken = payload.hora ? formatTimeSpoken(payload.hora) : 'ese horario';

  const alternatives = payload.fecha && payload.servicios.length
    ? await findRealSlotOptions({
        employees,
        preferredEmployeeId: user.rol === 'EMPLEADO' || payload.empleadoFijado ? fallbackEmployee.id : null,
        fecha: payload.fecha,
        franja: payload.franja,
        servicios: payload.servicios,
        excludeCitaId,
        maxOptions: 5,
        searchFutureDays: true,
        db: tx,
      })
    : { status: 'none' as const, options: [] as OfferedSlot[], allMatching: [] as OfferedSlot[] };

  const filteredOptions = alternatives.options.filter(
    slot => !(slot.fecha === payload.fecha && slot.hora === payload.hora && slot.empleadoId === fallbackEmployee.id),
  );

  const nextPayload: DraftPayload = {
    ...payload,
    hora: null,
    horariosOfrecidos: filteredOptions,
    pendiente: 'hora',
    confirmacionSolicitada: false,
  };

  const updated = await tx.iaBorrador.update({
    where: { id: draftId },
    data: {
      payload: nextPayload as unknown as Prisma.InputJsonValue,
      revision: { increment: 1 },
    },
  });

  const refreshedDraft = await draftView(
    draftId,
    updated.revision ?? 1,
    updated.expiresAt ?? new Date(Date.now() + 15 * 60000),
    nextPayload,
    user,
    tx,
  );

  const showDates = alternatives.status === 'next_days' || new Set(filteredOptions.map(s => s.fecha)).size > 1;
  const error = filteredOptions.length
    ? `El horario de las ${occupiedTime} se ocupó antes de confirmar. Aquí tienes nuevas opciones disponibles:\n${formatSlotListText(filteredOptions, showDates)}\nElige una diciendo «la primera», «la segunda» o tocando una opción.`
    : `El horario de las ${occupiedTime} se ocupó antes de confirmar y no hay más espacio en esa fecha${payload.franja ? ` ${timeWindowLabel(payload.franja)}` : ''}. Pide otro día o servicio.`;
  const spokenText = filteredOptions.length
    ? `El horario de las ${occupiedSpoken} acaba de ocuparse. Tengo estas nuevas opciones: ${formatSlotListSpoken(filteredOptions, showDates)} ¿Cuál prefieres?`
    : `El horario de las ${occupiedSpoken} acaba de ocuparse y no quedan espacios disponibles en esa fecha. ¿Quieres probar otro día?`;

  return {
    occupied: true as const,
    error,
    spokenText,
    draft: refreshedDraft,
    horariosOfrecidos: filteredOptions,
  };
}

export async function confirmDraft(user: AssistantUser, id: string, revision: number) {
  const result = await prisma.$transaction(async (tx: Db) => {
    await tx.$queryRaw`SELECT "id" FROM "IaBorrador" WHERE "id" = ${id} AND "userId" = ${user.id} FOR UPDATE`;
    const draft = await tx.iaBorrador.findFirst({ where: { id, userId: user.id } });
    if (!draft) throw new AssistantError('Borrador no encontrado.', 404);
    if (draft.revision !== revision) {
      throw new AssistantError('El resumen cambió. Revisa la versión más reciente antes de confirmar.', 409);
    }

    const payload = DraftPayloadSchema.parse(draft.payload);
    const operacion: DraftOperation = payload.operacion ?? 'crear';

    if (draft.estado === 'CONFIRMADO') {
      const existingId = draft.citaId ?? payload.citaObjetivoId;
      if (existingId) {
        return { citaId: existingId, operacion, replay: true as const };
      }
    }
    if (draft.estado !== 'BORRADOR' || draft.expiresAt <= new Date()) {
      throw new AssistantError('El borrador venció. Prepara la solicitud de nuevo.', 409);
    }

    // ── Confirm Cancellation ──
    if (operacion === 'cancelar') {
      if (!payload.citaObjetivoId) {
        throw new AssistantError('Selecciona la cita antes de confirmar la cancelación.');
      }
      const cancelled = await cancelAppointmentInTransaction(tx, {
        citaId: payload.citaObjetivoId,
        userId: user.id,
        userRole: user.rol,
        expectedUpdatedAt: payload.citaObjetivoUpdatedAt,
        motivo: payload.motivoCancelacion,
      });
      if ('error' in cancelled) {
        throw new AssistantError(cancelled.error ?? 'No se pudo cancelar la cita.', cancelled.status);
      }
      await tx.iaBorrador.update({ where: { id }, data: { estado: 'CONFIRMADO' } });
      return {
        citaId: cancelled.cita.id,
        operacion,
        replay: false as const,
        beforeData: cancelled.beforeData,
        afterData: cancelled.cita,
      };
    }

    // ── Confirm Reschedule ──
    if (operacion === 'reprogramar') {
      const { citaObjetivoId, empleadoId, fecha, hora } = payload;
      if (!citaObjetivoId || !empleadoId || !fecha || !hora || !payload.servicios.length) {
        throw new AssistantError('Completa el borrador de reprogramación antes de confirmar.');
      }
      scopedEmployee(user, empleadoId);
      requireFutureTime(fecha, hora);

      const empleado = await tx.empleado.findUnique({
        where: { id: empleadoId },
        select: { nombre: true, activo: true, esAgendable: true },
      });
      if (!empleado?.activo || !empleado.esAgendable) {
        throw new AssistantError('El profesional ya no está disponible.', 409);
      }

      const rescheduled = await rescheduleAppointmentInTransaction(tx, {
        citaId: citaObjetivoId,
        targetEmpleadoId: empleadoId,
        fecha,
        hora,
        userId: user.id,
        userRole: user.rol,
        expectedUpdatedAt: payload.citaObjetivoUpdatedAt,
        permitirHorarioExtendido: false,
      });

      if ('error' in rescheduled) {
        if (rescheduled.status === 409 && rescheduled.type !== 'CONCURRENT_EDIT') {
          return buildConflictRecovery(
            tx,
            id,
            user,
            payload,
            { id: empleadoId, nombre: empleado.nombre ?? 'Profesional asignado' },
            citaObjetivoId,
          );
        }
        throw new AssistantError(rescheduled.error ?? 'No se pudo reprogramar la cita.', rescheduled.status);
      }

      await tx.iaBorrador.update({ where: { id }, data: { estado: 'CONFIRMADO' } });
      return {
        citaId: rescheduled.cita.id,
        operacion,
        replay: false as const,
        beforeData: rescheduled.beforeData,
        afterData: rescheduled.cita,
      };
    }

    // ── Confirm New Appointment Creation ──
    const { clienteId, empleadoId, fecha, hora } = payload;
    if (!clienteId || !empleadoId || !fecha || !hora || !payload.servicios.length) {
      throw new AssistantError('Completa el borrador antes de confirmar.');
    }
    scopedEmployee(user, empleadoId);
    requireFutureTime(fecha, hora);

    const [cliente, empleado, services] = await Promise.all([
      tx.cliente.findUnique({ where: { id: clienteId }, select: { nombre: true, telefono: true } }),
      tx.empleado.findUnique({ where: { id: empleadoId }, select: { nombre: true, activo: true, esAgendable: true } }),
      tx.servicio.findMany({
        where: { id: { in: payload.servicios.map(service => service.id) }, activo: true },
        select: { id: true, nombre: true, duracion: true },
      }),
    ]);

    if (!cliente || !empleado?.activo || !empleado.esAgendable || services.length !== payload.servicios.length) {
      throw new AssistantError('El cliente, profesional o servicio ya no está disponible. Prepara la cita nuevamente.', 409);
    }

    const refreshed = payload.servicios.map(service => services.find(current => current.id === service.id)!);
    if (
      refreshed.some(
        (service, index) =>
          service.duracion !== payload.servicios[index].duracion
          || service.nombre !== payload.servicios[index].nombre,
      )
    ) {
      payload.servicios = refreshed;
      const updated = await tx.iaBorrador.update({
        where: { id },
        data: { payload: payload as unknown as Prisma.InputJsonValue, revision: { increment: 1 } },
      });
      return {
        changed: true as const,
        draft: await draftView(id, updated.revision, updated.expiresAt, payload, user, tx),
      };
    }

    const created = await createAppointmentInTransaction(tx, {
      finalEmpleadoId: empleadoId,
      fecha,
      hora,
      primerServicioId: refreshed[0].id,
      duracionCalculada: refreshed.reduce((sum, service) => sum + service.duracion, 0),
      serviciosParaCita: refreshed,
      permitirHorarioExtendido: false,
      allowOverlap: false,
      userRole: user.rol,
      userId: user.id,
      idClienteFinal: clienteId,
      finalClienteNombre: cliente.nombre,
      finalClienteTelefono: cliente.telefono,
    });

    if ('error' in created || 'type' in created) {
      return buildConflictRecovery(
        tx,
        id,
        user,
        payload,
        { id: empleadoId, nombre: empleado.nombre ?? 'Profesional asignado' },
      );
    }

    await tx.iaBorrador.update({ where: { id }, data: { estado: 'CONFIRMADO', citaId: created.cita.id } });
    return { citaId: created.cita.id, operacion, replay: false as const };
  }, { timeout: 15000 });

  if ('changed' in result) {
    return {
      status: 409,
      body: {
        error: 'Cambió el servicio o su duración. Revisa el resumen actualizado y confirma de nuevo.',
        draft: result.draft,
      },
    };
  }

  if ('occupied' in result) {
    return {
      status: 409,
      body: {
        error: result.error,
        code: 'SLOT_OCCUPIED',
        spokenText: result.spokenText,
        draft: result.draft,
        horarios: result.horariosOfrecidos.map((slot: OfferedSlot) => slot.hora),
        horariosOfrecidos: result.horariosOfrecidos,
      },
    };
  }

  if (!result.replay) {
    if (result.operacion === 'reprogramar') {
      await logAudit({
        action: 'APPOINTMENT_RESCHEDULED',
        module: 'CITAS',
        status: 'SUCCESS',
        userId: user.id,
        userRole: user.rol,
        entityType: 'Cita',
        entityId: result.citaId,
        description: 'Cita reprogramada desde el asistente con confirmación en pantalla.',
        beforeData: result.beforeData,
        afterData: result.afterData,
        metadata: { origin: 'IA', draftId: id },
      });
    } else if (result.operacion === 'cancelar') {
      await logAudit({
        action: 'APPOINTMENT_CANCELLED',
        module: 'CITAS',
        status: 'SUCCESS',
        userId: user.id,
        userRole: user.rol,
        entityType: 'Cita',
        entityId: result.citaId,
        description: 'Cita cancelada desde el asistente con confirmación en pantalla.',
        beforeData: result.beforeData,
        afterData: result.afterData,
        metadata: { origin: 'IA', draftId: id },
      });
    } else {
      await logAudit({
        action: 'APPOINTMENT_CREATED',
        module: 'CITAS',
        status: 'SUCCESS',
        userId: user.id,
        userRole: user.rol,
        entityType: 'Cita',
        entityId: result.citaId,
        description: 'Cita registrada desde el asistente con confirmación en pantalla.',
        metadata: { origin: 'IA', draftId: id },
      });
    }
  }

  const mensaje =
    result.operacion === 'reprogramar'
      ? 'Cita reprogramada correctamente.'
      : result.operacion === 'cancelar'
        ? 'Cita cancelada correctamente.'
        : 'Cita registrada correctamente.';

  return {
    status: result.replay ? 200 : result.operacion === 'crear' ? 201 : 200,
    body: {
      citaId: result.citaId,
      operacion: result.operacion,
      mensaje,
      spokenText: mensaje,
      replay: result.replay,
    },
  };
}
