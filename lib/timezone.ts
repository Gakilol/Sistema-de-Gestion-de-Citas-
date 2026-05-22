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
