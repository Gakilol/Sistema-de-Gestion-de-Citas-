export const CALENDAR_EVENT_TITLE = 'Cita en HAIR STYLE Salon & Barber';

export interface CalendarEventInput {
  fecha: string;
  hora: string;
  duracion: number;
  zonaHoraria: string;
  profesional: string;
  servicios?: string[];
  ubicacion?: string;
  clienteNombre?: string;
  variante?: 'cliente' | 'interno';
}

export interface CalendarDateTime {
  fecha: string;
  hora: string;
}

function assertDate(fecha: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('La fecha del evento no es válida');
  }
}

function assertTime(hora: string): void {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(hora);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new Error('La hora del evento no es válida');
  }
}

export function isValidTimeZone(zonaHoraria: string | null | undefined): zonaHoraria is string {
  if (!zonaHoraria) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zonaHoraria });
    return true;
  } catch {
    return false;
  }
}

/** Calcula el final como fecha/hora local, sin depender de la zona del navegador. */
export function calcularFinCita(fecha: string, hora: string, duracion: number): CalendarDateTime {
  assertDate(fecha);
  assertTime(hora);
  if (!Number.isInteger(duracion) || duracion <= 0) {
    throw new Error('La duración del evento no es válida');
  }

  const [year, month, day] = fecha.split('-').map(Number);
  const [hours, minutes] = hora.split(':').map(Number);
  const end = new Date(Date.UTC(year, month - 1, day, hours, minutes + duracion));

  return {
    fecha: end.toISOString().slice(0, 10),
    hora: `${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`,
  };
}

export function formatCalendarDateTime({ fecha, hora }: CalendarDateTime): string {
  const [year, month, day] = fecha.split('-');
  const [hours, minutes] = hora.split(':');
  return `${year}${month}${day}T${hours}${minutes}00`;
}

export function buildCalendarDescription(input: Pick<CalendarEventInput, 'profesional' | 'servicios'>): string {
  const lines = [`Profesional: ${input.profesional}`];
  if (input.servicios?.length) lines.push(`Servicios: ${input.servicios.join(', ')}`);
  lines.push('', 'Recuerde presentarse 5 minutos antes de su cita.');
  return lines.join('\n');
}

function buildInternalCalendarDescription(input: CalendarEventInput): string {
  const servicios = input.servicios?.filter(Boolean) ?? [];
  const etiquetaServicio = servicios.length === 1 ? 'Servicio' : 'Servicios';
  const lines = [
    `Cliente: ${input.clienteNombre || 'Cliente'}`,
    `${etiquetaServicio}: ${servicios.join(', ') || 'Servicio general'}`,
    `Duración: ${input.duracion} minutos`,
    `Atendido por: ${input.profesional}`,
  ];
  return lines.join('\n');
}

/** Construye una URL de Google Calendar sin PII ni identificadores internos. */
export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const inicio = { fecha: input.fecha, hora: input.hora };
  const fin = calcularFinCita(input.fecha, input.hora, input.duracion);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.variante === 'interno' ? `Cita - ${input.clienteNombre || 'Cliente'}` : CALENDAR_EVENT_TITLE,
    dates: `${formatCalendarDateTime(inicio)}/${formatCalendarDateTime(fin)}`,
    details: input.variante === 'interno' ? buildInternalCalendarDescription(input) : buildCalendarDescription(input),
    ctz: input.zonaHoraria,
  });
  if (input.ubicacion) params.set('location', input.ubicacion);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
