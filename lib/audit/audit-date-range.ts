import { getBusinessDayStartUTC, getBusinessTodayString, isValidBusinessDateString, parseLocalDateToUTC } from '@/lib/timezone';

const DAY_MS = 86_400_000;

export function parseAuditDateRange(rawFrom: string, rawTo: string):
  | { start: Date; endExclusive: Date }
  | { error: string } {
  const today = parseLocalDateToUTC(getBusinessTodayString());
  const from = rawFrom || new Date(today.getTime() - 29 * DAY_MS).toISOString().slice(0, 10);
  const to = rawTo || today.toISOString().slice(0, 10);
  if (!isValidBusinessDateString(from) || !isValidBusinessDateString(to)) {
    return { error: 'Fechas inválidas. Formato YYYY-MM-DD.' };
  }
  const fromDay = parseLocalDateToUTC(from);
  const toDay = parseLocalDateToUTC(to);
  if (fromDay > toDay) return { error: 'La fecha de inicio no puede ser mayor que la de fin.' };
  if ((toDay.getTime() - fromDay.getTime()) / DAY_MS > 365) {
    return { error: 'El rango de fechas no puede exceder los 365 días.' };
  }
  const nextDay = new Date(toDay.getTime() + DAY_MS).toISOString().slice(0, 10);
  return { start: getBusinessDayStartUTC(from), endExclusive: getBusinessDayStartUTC(nextDay) };
}
