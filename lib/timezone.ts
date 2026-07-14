// lib/timezone.ts
// Utilidades de zona horaria para HAIR STYLE Salón & Barber
// Asegura consistencia total entre Frontend (Cliente), Backend (Serverless Vercel) y Base de Datos (Prisma/PostgreSQL).

export const BUSINESS_TIMEZONE = 'America/Costa_Rica';

/**
 * Formatea una fecha de base de datos (tipo @db.Date, que Prisma entrega como UTC medianoche)
 * en un string legible en español costarricense ('es-CR'), sin sufrir corrupciones por huso horario local.
 */
export function formatDBDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Forzar que el formateo ocurra en UTC para evitar desfases debido a la conversión local
  const formatted = d.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
  
  // Reemplazar puntos de abreviatura si los hay
  return formatted.replace(/\./g, '');
}

/**
 * Formatea una fecha de base de datos en formato extendido para mensajes de WhatsApp.
 */
export function formatDBDateLong(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleDateString('es-CR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

/**
 * Retorna la fecha actual en la zona horaria del negocio en formato 'YYYY-MM-DD'.
 * Esto evita usar la fecha del sistema local del navegador o de los servidores de Vercel.
 */
export function getBusinessTodayString(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Retorna la hora actual en la zona horaria del negocio en formato de 24 horas 'HH:MM'.
 */
export function getBusinessNowTime(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(d);
}

/**
 * Parsea un string de fecha 'YYYY-MM-DD' en un objeto Date en UTC medianoche.
 * Esto coincide exactamente con cómo Prisma espera recibir y guardar las fechas.
 */
export function parseLocalDateToUTC(fechaYYYYMMDD: string): Date {
  const [year, month, day] = fechaYYYYMMDD.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Retorna la fecha por defecto para reservar una cita.
 * Si la hora actual en Costa Rica es mayor o igual a las 6:30 PM (18:30), retorna la fecha del día siguiente,
 * de lo contrario retorna la fecha de hoy.
 */
export function getDefaultBookingDate(): string {
  const d = new Date();
  
  // Obtener la hora actual en Costa Rica (formato 24h)
  const formatterTime = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  
  const timeStr = formatterTime.format(d);
  const [hour, minute] = timeStr.split(':').map(Number);
  
  // Obtener la fecha de hoy en Costa Rica
  const formatterDate = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatterDate.formatToParts(d);
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const day = Number(parts.find(p => p.type === 'day')?.value);
  
  // Crear fecha base en UTC usando el año, mes y día de Costa Rica
  const dateCR = new Date(Date.UTC(year, month - 1, day));
  
  // Si son las 6:30 PM o más tarde, se suma un día
  if (hour > 18 || (hour === 18 && minute >= 30)) {
    dateCR.setUTCDate(dateCR.getUTCDate() + 1);
  }
  
  const nextYear = dateCR.getUTCFullYear();
  const nextMonth = String(dateCR.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(dateCR.getUTCDate()).padStart(2, '0');
  
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

/**
 * Función CENTRAL para la fecha predeterminada del Calendario y la Agenda.
 *
 * Regla de negocio:
 *   - Antes de las 18:30 en America/Costa_Rica → retorna hoy (YYYY-MM-DD).
 *   - Desde las 18:30 en adelante             → retorna mañana (YYYY-MM-DD).
 *
 * Garantías:
 *   - Siempre evalúa la hora en America/Costa_Rica, independientemente de:
 *       • la zona horaria del navegador del usuario,
 *       • la zona horaria del servidor de Vercel (que corre en UTC),
 *       • cualquier otro entorno.
 *   - No produce desfases por serialización UTC: la fecha se construye
 *     componente a componente (año, mes, día) en CR, luego se avanza 1 día
 *     usando aritmética UTC pura (sin conversión de nuevo a local).
 *   - No modifica citas, no crea datos, no altera permisos.
 *
 * @param now  Fecha de referencia para tests (simula "la hora actual").
 *             En producción se omite; se usa `new Date()` automáticamente.
 * @returns    String "YYYY-MM-DD" con la fecha predeterminada.
 *
 * @example
 *   // Producción (sin argumento):
 *   getDefaultAgendaDate()           // e.g. "2025-07-15"
 *
 *   // Test simulado (18:30 exacto en CR → mañana):
 *   getDefaultAgendaDate(new Date('2025-07-15T00:30:00Z'))  // "2025-07-16"
 *   // (2025-07-15T00:30 UTC = 2025-07-14T18:30 CR)
 */
export function getDefaultAgendaDate(now?: Date): string {
  const d = now ?? new Date();

  // ── 1. Obtener hora actual en Costa Rica (formato 24 h) ──────────────────
  const formatterTime = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const timeStr = formatterTime.format(d);
  // Intl puede devolver "24:xx" a medianoche en algunos entornos; normalizamos
  const [hourRaw, minute] = timeStr.split(':').map(Number);
  const hour = hourRaw === 24 ? 0 : hourRaw;

  // ── 2. Obtener la fecha de hoy en Costa Rica ─────────────────────────────
  const formatterDate = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatterDate.formatToParts(d);
  const year  = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const day   = Number(parts.find(p => p.type === 'day')?.value);

  // ── 3. Construir fecha base en UTC medianoche (coincide con Prisma @db.Date)
  const dateCR = new Date(Date.UTC(year, month - 1, day));

  // ── 4. Aplicar la regla de las 18:30 ────────────────────────────────────
  if (hour > 18 || (hour === 18 && minute >= 30)) {
    dateCR.setUTCDate(dateCR.getUTCDate() + 1);
  }

  // ── 5. Formatear resultado como YYYY-MM-DD ───────────────────────────────
  const ry = dateCR.getUTCFullYear();
  const rm = String(dateCR.getUTCMonth() + 1).padStart(2, '0');
  const rd = String(dateCR.getUTCDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}
