import { checkToolPermission } from './permissions';
import { executeIATool } from './tools';
import { formatTime12Hour } from '@/lib/time-utils';
import { getBusinessTodayString } from '@/lib/timezone';
import type {
  IAAppointmentDraft,
  IAAppointmentDraftField,
  IAClientDraft,
  IAConversationMessage,
  IAExecutionContext,
  IAToolName,
} from './types';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s'-])([a-záéíóúñü])/giu, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
    .replace(/\b(Y|De|Del)\b/g, (word) => word.toLowerCase());
}

function sentenceCase(value: string) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned ? `${cleaned[0].toUpperCase()}${cleaned.slice(1).toLowerCase()}` : cleaned;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export function parseHumanDate(message: string, today: string): string | undefined {
  const text = normalize(message);
  const relativeText = text.replace(/\b(?:de|por)\s+la\s+manana\b/g, '');
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (slash) {
    const year = slash[3] ?? today.slice(0, 4);
    return `${year}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  }

  const written = text.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+(20\d{2}))?\b/);
  if (written) {
    const year = written[3] ?? today.slice(0, 4);
    return `${year}-${String(MONTHS[written[2]]).padStart(2, '0')}-${written[1].padStart(2, '0')}`;
  }

  if (/pasado\s+manana/.test(relativeText)) return addDays(today, 2);
  if (/\bmanana\b/.test(relativeText)) return addDays(today, 1);
  if (/\bhoy\b/.test(relativeText)) return today;

  const weekday = Object.keys(WEEKDAYS).find((day) => new RegExp(`\\b${day}\\b`).test(text));
  if (weekday) {
    const [year, month, day] = today.split('-').map(Number);
    const current = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const difference = (WEEKDAYS[weekday] - current + 7) % 7;
    return addDays(today, difference);
  }
  return undefined;
}

export function parseHumanTime(message: string): string | undefined {
  const text = normalize(message).replace(/a\.\s*m\./g, 'am').replace(/p\.\s*m\./g, 'pm');
  const match = text.match(/(?:\ba\s+las?\s+|\bhora\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|de\s+la\s+manana|de\s+la\s+tarde|de\s+la\s+noche)\b/)
    ?? text.match(/\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const period = match[3] ?? '';
  if (hour > 23 || minute > 59) return undefined;
  if ((period === 'pm' || period.includes('tarde') || period.includes('noche')) && hour < 12) hour += 12;
  if ((period === 'am' || period.includes('manana')) && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function extractNamedValue(message: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = message.match(pattern)?.[1]?.trim().replace(/[.,;]+$/g, '');
    if (match && match.length >= 2) return titleCase(match);
  }
  return undefined;
}

function answerForField(message: string, field: IAAppointmentDraftField, today: string) {
  const cleaned = message.trim().replace(/^(?:es|ser[ií]a|el servicio es|la fecha es|la hora es|con)\s+/i, '').trim();
  if (field === 'fecha') return parseHumanDate(cleaned, today);
  if (field === 'hora') return parseHumanTime(cleaned);
  return field === 'servicio' ? sentenceCase(cleaned) : titleCase(cleaned);
}

export function parseAppointmentMessage(message: string, current: IAAppointmentDraft, today: string): IAAppointmentDraft {
  const draft: IAAppointmentDraft = { ...current, awaitingField: undefined };
  if (current.awaitingField) {
    const answer = answerForField(message, current.awaitingField, today);
    if (answer) draft[current.awaitingField] = answer;
    else draft.awaitingField = current.awaitingField;
  }

  const cliente = extractNamedValue(message, [
    /(?:cita\s+(?:para|a\s+nombre\s+de)\s+(?:el\s+cliente\s+)?|cliente\s+|para\s+el\s+cliente\s+)([\p{L}][\p{L}' -]*?)(?=\s*,|\s+(?:lo|la)\s+atender|\s+con\s+|\s+(?:el\s+)?d[ií]a\b|\s+para\s+(?:el\s+)?(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)|\s+(?:hoy|mañana|manana)\b|\s+a\s+las?\b|$)/iu,
    /(?:a\s+nombre\s+de)\s+([\p{L}][\p{L}' -]{1,80})/iu,
  ]);
  if (cliente) draft.cliente = cliente;

  const profesional = extractNamedValue(message, [
    /(?:lo|la)?\s*atender[aá]\s+([\p{L}][\p{L}' -]*?)(?=\s*,|\s+(?:el\s+)?d[ií]a\b|\s+(?:hoy|mañana|manana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b|\s+a\s+las?\b|$)/iu,
    /(?:con\s+(?:el|la)?\s*(?:estilista|barbero|profesional)?\s*)([\p{L}][\p{L}' -]*?)(?=\s*,|\s+(?:el\s+)?d[ií]a\b|\s+(?:hoy|mañana|manana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b|\s+a\s+las?\b|$)/iu,
  ]);
  if (profesional) draft.profesional = profesional.replace(/\s+(El|La)$/i, '');

  const serviceMatch = message.match(/\b(corte(?:\s+y\s+barba)?|barba|tinte|coloraci[oó]n|manicure|pedicure|peinado|alisado|keratina|lavado|depilaci[oó]n|maquillaje)\b/iu)?.[1];
  if (serviceMatch) draft.servicio = sentenceCase(serviceMatch);

  const fecha = parseHumanDate(message, today);
  if (fecha) draft.fecha = fecha;
  const hora = parseHumanTime(message);
  if (hora) draft.hora = hora;

  const phone = message.match(/(?:tel[eé]fono|n[uú]mero|celular)\s*(?:es|:)?\s*(\+?\d[\d\s-]{6,20})/i)?.[1]?.trim();
  if (phone) draft.telefono = phone;
  return draft;
}

function parseClientMessage(message: string, current: IAClientDraft): IAClientDraft {
  const draft: IAClientDraft = { ...current, awaitingField: undefined };
  const nameMatch = message.match(/(?:cliente\s+(?:llamad[oa]|de\s+nombre|a\s+nombre\s+de)\s+|llamad[oa]\s+)([\p{L}][\p{L}' -]*?)(?=\s*,|\s+con\s+(?:tel[eé]fono|celular|correo|email)|$)/iu)
    ?? message.match(/(?:registrar|registra|crear|crea|nuevo)\s+(?:a\s+|un\s+)?cliente\s+([\p{L}][\p{L}' -]*?)(?=\s*,|\s+con\s+(?:tel[eé]fono|celular|correo|email)|$)/iu);
  if (nameMatch?.[1]?.trim()) {
    draft.nombre = titleCase(nameMatch[1]);
  } else if (current.awaitingField === 'nombre') {
    const directName = message
      .split(/,|\b(?:con\s+)?(?:tel[eé]fono|celular|correo|email)\b/i)[0]
      .replace(/^(?:se\s+llama|es|nombre|llamad[oa])\s+/i, '')
      .trim();
    if (directName.length >= 2) draft.nombre = titleCase(directName);
    else draft.awaitingField = 'nombre';
  }

  const phone = message.match(/(?:tel[eé]fono|n[uú]mero|celular)\s*(?:es|:)?\s*(\+?\d[\d\s-]{6,20})/i)?.[1]?.trim();
  if (phone) draft.telefono = phone;
  const email = message.match(/(?:correo|email)\s*(?:es|:)?\s*([^\s,]+@[^\s,]+\.[^\s,]+)/i)?.[1]?.trim();
  if (email) draft.email = email;
  return draft;
}

function extractDays(value: string, fallback = 30) {
  const match = normalize(value).match(/(\d{1,3})\s*dias?/);
  return match ? Math.max(1, Math.min(180, Number(match[1]))) : fallback;
}

export function detectLocalIntent(message: string): { tool?: IAToolName; args: Record<string, unknown> } {
  const text = normalize(message);
  if (/citas? de hoy|agenda de hoy|quien viene hoy/.test(text)) return { tool: 'getTodayAppointments', args: {} };
  if (/resumen|cuantas citas|estado.*citas|panorama/.test(text)) return { tool: 'getAppointmentSummary', args: {} };
  if (/servicios?.*(popular|solicitado|frecuente)|mas pedidos/.test(text)) return { tool: 'getPopularServices', args: { dias: extractDays(message) } };
  if (/carga.*(equipo|personal)|citas por (empleado|estilista|barbero)|productividad/.test(text)) return { tool: 'getStaffWorkload', args: { dias: extractDays(message) } };
  const clientMatch = message.match(/(?:busca|buscar|encuentra|cliente)\s+(?:al?\s+cliente\s+)?(.+)/i);
  if (clientMatch?.[1]?.trim()) return { tool: 'searchClients', args: { query: clientMatch[1].trim(), limit: 8 } };
  return { args: {} };
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  EN_PROGRESO: 'En progreso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  NO_SHOW: 'No asistió',
};

export function formatLocalToolResult(tool: IAToolName, data: unknown) {
  if (tool === 'getTodayAppointments') {
    const appointments = Array.isArray(data) ? data as Array<Record<string, any>> : [];
    if (appointments.length === 0) return 'No hay citas programadas para hoy.';
    return appointments.map((item) => `- ${formatTime12Hour(String(item.hora))} — ${item.cliente_nombre} · ${item.servicio?.nombre ?? 'Servicio'} · con ${item.empleado?.nombre ?? 'Profesional'} · ${STATUS_LABELS[item.estado] ?? item.estado}`).join('\n');
  }
  if (tool === 'searchClients') {
    const clients = Array.isArray(data) ? data as Array<Record<string, any>> : [];
    if (clients.length === 0) return 'No encontré clientes con ese nombre o teléfono.';
    return clients.map((item) => `- ${item.nombre}${item.telefono ? ` · ${item.telefono}` : ''} · ${item._count?.citas ?? 0} citas`).join('\n');
  }
  if (tool === 'getPopularServices') {
    const services = Array.isArray(data) ? data as Array<Record<string, any>> : [];
    if (services.length === 0) return 'Todavía no hay suficientes citas completadas para comparar servicios.';
    return services.map((item) => `- ${item.servicio}: ${item.citas} citas`).join('\n');
  }
  if (tool === 'getStaffWorkload') {
    const staff = Array.isArray(data) ? data as Array<Record<string, any>> : [];
    if (staff.length === 0) return 'No encontré citas para el equipo en ese período.';
    return staff.map((item) => `- ${item.profesional}: ${item.citas} citas`).join('\n');
  }
  if (tool === 'getAppointmentSummary' && data && typeof data === 'object') {
    const summary = data as Record<string, any>;
    return `Hoy hay ${summary.total ?? 0} citas: ${summary.pendientes ?? 0} pendientes, ${summary.enProgreso ?? 0} en progreso, ${summary.completadas ?? 0} completadas y ${summary.canceladas ?? 0} canceladas.`;
  }
  return 'Consulta completada.';
}

function isAppointmentCreation(message: string) {
  const text = normalize(message);
  return /\b(crea|crear|registre|registrar|agenda|agendar|reserva|reservar|sacar|nueva)\b.*\b(cita|turno|espacio)\b|\b(cita|turno)\b.*\b(para|con|el|la)\b/.test(text);
}

function isClientCreation(message: string) {
  return /\b(registra|registrar|registre|crear|crea|nuevo)\b.*\bcliente\b/.test(normalize(message));
}

const QUESTIONS: Record<IAAppointmentDraftField, string> = {
  cliente: '¿A nombre de quién será la cita?',
  servicio: '¿Qué servicio desea reservar?',
  profesional: '¿Con qué profesional desea atenderse?',
  fecha: '¿Para qué día será la cita? Puedes decir “mañana”, “el lunes” o una fecha.',
  hora: '¿A qué hora desea la cita?',
};

function nextMissingField(draft: IAAppointmentDraft, context: IAExecutionContext): IAAppointmentDraftField | undefined {
  if (!draft.cliente) return 'cliente';
  if (!draft.servicio) return 'servicio';
  if (context.userRole !== 'EMPLEADO' && !draft.profesional) return 'profesional';
  if (!draft.fecha) return 'fecha';
  if (!draft.hora) return 'hora';
  return undefined;
}

function fieldFromToolError(error: string): IAAppointmentDraftField | undefined {
  const text = normalize(error);
  if (/servicio/.test(text)) return 'servicio';
  if (/profesional|empleado/.test(text)) return 'profesional';
  if (/horario|hora/.test(text)) return 'hora';
  if (/fecha|pasado/.test(text)) return 'fecha';
  return undefined;
}

export async function runLocalAssistant(messages: IAConversationMessage[], context: IAExecutionContext) {
  const latestMessage = messages.at(-1)?.content ?? '';
  const previousDraft = [...messages].reverse().find((message) => message.appointmentDraft)?.appointmentDraft;
  const previousClientDraft = [...messages].reverse().find((message) => message.clientDraft)?.clientDraft;

  if (previousClientDraft || isClientCreation(latestMessage)) {
    const draft = parseClientMessage(latestMessage, previousClientDraft ?? {});
    if (!draft.nombre) {
      draft.awaitingField = 'nombre';
      return {
        text: '¿Cómo se llama el cliente?',
        toolsUsed: [],
        mode: 'local_guided',
        clientDraft: draft,
      };
    }

    const result = await executeIATool('prepareCreateClient', draft, context);
    if (!result.ok) {
      return {
        text: result.error,
        toolsUsed: ['prepareCreateClient'],
        mode: 'local_guided',
        clientDraft: draft,
      };
    }
    return {
      text: 'Preparé los datos del cliente. Revisa el resumen antes de guardarlo.',
      toolsUsed: ['prepareCreateClient'],
      mode: 'local_guided',
      pendingAction: result.pendingAction,
    };
  }

  if (previousDraft || isAppointmentCreation(latestMessage)) {
    const draft = parseAppointmentMessage(latestMessage, previousDraft ?? {}, getBusinessTodayString());
    const missing = nextMissingField(draft, context);
    if (missing) {
      draft.awaitingField = missing;
      return { text: QUESTIONS[missing], toolsUsed: [], mode: 'local_guided', appointmentDraft: draft };
    }

    const result = await executeIATool('prepareCreateAppointment', draft, context);
    if (!result.ok) {
      const field = fieldFromToolError(result.error);
      if (field) {
        delete draft[field];
        draft.awaitingField = field;
      }
      return {
        text: `${result.error}${field ? `\n\n${QUESTIONS[field]}` : ''}`,
        toolsUsed: ['prepareCreateAppointment'],
        mode: 'local_guided',
        appointmentDraft: draft,
      };
    }
    return {
      text: 'Encontré el servicio, el profesional y un horario válido. Revisa el resumen antes de guardar.',
      toolsUsed: ['prepareCreateAppointment'],
      mode: 'local_guided',
      pendingAction: result.pendingAction,
    };
  }

  const intent = detectLocalIntent(latestMessage);
  if (!intent.tool) {
    return {
      text: 'Puedo crear una cita paso a paso, registrar clientes y consultar la agenda. Pulsa “Crear cita” o dime qué necesitas con tus propias palabras.',
      toolsUsed: [],
      mode: 'local_operational',
    };
  }
  if (!checkToolPermission(intent.tool, context.userRole)) {
    return { text: 'Tu rol no tiene permiso para realizar esa consulta.', toolsUsed: [], mode: 'local_operational' };
  }
  const result = await executeIATool(intent.tool, intent.args, context);
  if (!result.ok) return { text: result.error, toolsUsed: [intent.tool], mode: 'local_operational' };
  return {
    text: `${formatLocalToolResult(intent.tool, result.data)}\n\nDatos consultados en HAIR STYLE.`,
    toolsUsed: [intent.tool],
    mode: 'local_operational',
  };
}
