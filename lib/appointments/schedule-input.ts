import { isValidBusinessDateString } from '@/lib/timezone';

export function isValidTimeRange(start: unknown, end: unknown): boolean {
  if (typeof start !== 'string' || typeof end !== 'string') return false;
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
  return validTime.test(start) && validTime.test(end) && start < end;
}

export function isValidTimeOffInput(value: unknown): value is Array<{ fecha_inicio: string; fecha_fin: string; estado?: string }> {
  return Array.isArray(value) && value.every(v =>
    v && isValidBusinessDateString(v.fecha_inicio) && isValidBusinessDateString(v.fecha_fin) &&
    v.fecha_inicio <= v.fecha_fin && (v.estado == null || ['APROBADO', 'PENDIENTE'].includes(v.estado))
  );
}

export function isValidBlockInput(value: unknown): value is Array<{ fecha: string; hora_inicio: string; hora_fin: string; motivo?: string }> {
  return Array.isArray(value) && value.every(v =>
    v && isValidBusinessDateString(v.fecha) && isValidTimeRange(v.hora_inicio, v.hora_fin) &&
    (v.motivo == null || typeof v.motivo === 'string')
  );
}

export function isValidBreakInput(value: unknown): value is Array<{ dia_semana: number; hora_inicio: string; hora_fin: string }> {
  return Array.isArray(value) && value.every(v =>
    v && (typeof v.dia_semana === 'number' || /^[0-6]$/.test(v.dia_semana)) &&
    Number.isInteger(Number(v.dia_semana)) && Number(v.dia_semana) >= 0 &&
    Number(v.dia_semana) <= 6 && isValidTimeRange(v.hora_inicio, v.hora_fin)
  );
}
