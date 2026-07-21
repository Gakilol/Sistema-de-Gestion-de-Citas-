// lib/ics.ts
// Generador de archivos iCalendar (.ics) compatibles con
// Apple Calendar, Outlook, Google Calendar y calendarios Android.
//
// Requisitos:
// - Saltos de línea CRLF
// - UID estable por cita
// - Escapado correcto de caracteres especiales
// - Zona horaria configurada por el negocio
// - No incluir precios ni datos sensibles

const CRLF = '\r\n';
const PRODID = '-//HAIR STYLE Salon & Barber//Citas//ES';

/**
 * Escapa texto para campos iCalendar según RFC 5545.
 * Escapa barras invertidas, punto y coma, comas y saltos de línea.
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Genera un UID estable y único para un evento.
 * Basado en el ID de la cita para que reimportaciones actualicen el evento.
 */
function generarUID(citaId: string): string {
  return `cita-${citaId}@hairstyle-salon`;
}

/**
 * Formatea una fecha+hora en formato iCalendar con zona horaria.
 * Formato: TZID=America/Costa_Rica:YYYYMMDDTHHmmss
 */
/**
 * Genera el DTSTAMP en formato UTC (momento actual).
 */
function generarDTSTAMP(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

export interface ICSParams {
  citaId: string;
  clienteNombre: string;
  fecha: string;        // YYYY-MM-DD
  hora: string;         // HH:MM
  duracion: number;     // minutos
  profesional: string;
  servicios?: string[]; // nombres de servicios (solo si existen)
  ubicacion?: string;   // dirección del negocio (solo si existe)
  zonaHoraria: string;
}

/**
 * Genera el contenido de un archivo .ics válido.
 */
export function generarICS(params: ICSParams): string {
  const {
    citaId,
    clienteNombre,
    fecha,
    hora,
    duracion,
    profesional,
    servicios,
    ubicacion,
    zonaHoraria,
  } = params;

  const fin = calcularFinCita(fecha, hora, duracion);
  const dtStart = formatCalendarDateTime({ fecha, hora });
  const dtEnd = formatCalendarDateTime(fin);
  const uid = generarUID(citaId);
  const dtstamp = generarDTSTAMP();

  const summary = escapeICS(CALENDAR_EVENT_TITLE);
  const description = escapeICS(buildCalendarDescription({ profesional, servicios }));

  // Construir el evento
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${zonaHoraria}:${dtStart}`,
    `DTEND;TZID=${zonaHoraria}:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
  ];

  if (ubicacion) {
    lines.push(`LOCATION:${escapeICS(ubicacion)}`);
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join(CRLF) + CRLF;
}
import { buildCalendarDescription, calcularFinCita, CALENDAR_EVENT_TITLE, formatCalendarDateTime } from './calendar-event';
