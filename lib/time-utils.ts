// lib/time-utils.ts
// Fuente centralizada de verdad para conversión y validación de horas (12h <-> 24h)
// y reglas automáticas de negocio para la agenda de citas.

export interface ParsedTime12 {
  hour12: number;        // 1..12
  minute: number;        // 0..59
  period: 'AM' | 'PM';   // 'AM' | 'PM'
  isNormalRange: boolean; // true si está entre 8:00 AM y 6:00 PM (08:00 - 18:00 inclusive)
}

/**
 * Mapeo automático de AM/PM según la hora de negocio (1-12)
 * 8, 9, 10, 11 -> AM
 * 12, 1, 2, 3, 4, 5, 6 -> PM
 * Para otras horas (ej. 7), por defecto asigna AM (7 AM) o conserva el período seleccionado.
 */
export function resolveAutoPeriod(hour12: number): 'AM' | 'PM' {
  if (hour12 >= 8 && hour12 <= 11) {
    return 'AM';
  }
  return 'PM';
}

/**
 * Todas las horas de reloj de 12 horas disponibles directamente en el selector:
 * 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
 */
export const ALL_HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const NORMAL_HOURS = ALL_HOURS_12;

/**
 * Minutos permitidos en intervalos estándar: 00, 15, 30, 45
 */
export const NORMAL_MINUTES = [0, 15, 30, 45];

/**
 * Retorna las opciones de minutos permitidos para cualquier hora dada.
 */
export function getValidMinutesForHour(_hour12: number, _isCustomMode: boolean = false): number[] {
  return NORMAL_MINUTES;
}

/**
 * Convierte hora 12h (1..12), minuto (0..59) y período ('AM' | 'PM') a formato 24h "HH:MM".
 * Reglas de conversión exactas:
 * - 12:00 AM -> 00:00
 * - 07:00 AM -> 07:00
 * - 08:15 AM -> 08:15
 * - 12:00 PM -> 12:00
 * - 01:30 PM -> 13:30
 * - 06:00 PM -> 18:00
 * - 06:30 PM -> 18:30
 * - 07:45 PM -> 19:45
 * - 10:30 PM -> 22:30
 */
export function hour12To24h(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let hour24: number;
  if (period === 'AM') {
    hour24 = hour12 === 12 ? 0 : hour12;
  } else {
    hour24 = hour12 === 12 ? 12 : hour12 + 12;
  }

  const hStr = String(hour24).padStart(2, '0');
  const mStr = String(minute).padStart(2, '0');
  return `${hStr}:${mStr}`;
}

/**
 * Alias retrocompatible para normalHourTo24h
 */
export function normalHourTo24h(hour12: number, minute: number, manualPeriod?: 'AM' | 'PM'): string {
  const period = manualPeriod || resolveAutoPeriod(hour12);
  return hour12To24h(hour12, minute, period);
}

/**
 * Desglosa una hora 24h ("HH:MM") en formato 12h con indicación de si pertenece al horario normal de negocio (8:00 AM - 6:00 PM).
 */
export function parse24hToNormal(time24: string): ParsedTime12 {
  if (!time24 || !/^\d{2}:\d{2}(:\d{2})?$/.test(time24)) {
    return { hour12: 8, minute: 0, period: 'AM', isNormalRange: true };
  }

  const [hStr, mStr] = time24.split(':');
  const hour24 = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10) || 0;

  const totalMin = hour24 * 60 + minute;
  const isNormalRange = totalMin >= 8 * 60 && totalMin <= 18 * 60; // 08:00 (480m) a 18:00 (1080m) inclusive

  let period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;

  return {
    hour12,
    minute,
    period,
    isNormalRange,
  };
}

/**
 * Convierte un string 24h ("HH:MM") a formato 12h legible AM/PM.
 */
export function formatHora12h(time24: string): string {
  if (!time24) return '';
  const parsed = parse24hToNormal(time24);
  const mStr = String(parsed.minute).padStart(2, '0');
  return `${parsed.hour12}:${mStr} ${parsed.period}`;
}

/**
 * Redondea minutos al intervalo de 15 minutos más cercano (0, 15, 30, 45).
 */
export function snapTo15Minutes(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

/**
 * Convierte minutos desde medianoche a string 24h "HH:MM".
 */
export function minutesTo24hTime(minutes: number): string {
  const clamped = Math.min(Math.max(0, minutes), 24 * 60 - 1);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Valida si un string de hora en formato 24h cumple con el horario normal de atención (08:00 a 18:00) y minutos de 15m.
 */
export function validateNormalBusinessTime(time24: string): { valid: boolean; error?: string } {
  if (!/^\d{2}:\d{2}$/.test(time24)) {
    return { valid: false, error: 'Formato de hora inválido (debe ser HH:MM)' };
  }

  const [h, m] = time24.split(':').map(Number);
  const totalMin = h * 60 + m;

  if (totalMin < 8 * 60) {
    return { valid: false, error: 'La hora elegida está fuera del horario normal (antes de las 8:00 AM)' };
  }

  if (totalMin > 18 * 60) {
    return { valid: false, error: 'La hora elegida está fuera del horario normal (después de las 6:00 PM)' };
  }

  if (![0, 15, 30, 45].includes(m)) {
    return { valid: false, error: 'Los minutos deben ser en intervalos de 15 minutos (00, 15, 30, 45)' };
  }

  return { valid: true };
}

