import { formatDBDate, getBusinessTodayString } from '@/lib/timezone';

export const APPOINTMENT_STATUS_OPTIONS = [
  'PENDIENTE',
  'CONFIRMADA',
  'EN_PROGRESO',
  'COMPLETADA',
  'CANCELADA',
  'NO_SHOW',
  'REPROGRAMADA',
] as const;

export const APPOINTMENTS_PER_PAGE = 15;

export type AppointmentSmartFilter =
  | 'activas'
  | 'hoy'
  | 'manana'
  | 'semana'
  | 'mes'
  | 'historial'
  | 'todas';

export type AppointmentHistoryPeriod = 'todos' | 'diario' | 'semanal' | 'quincenal' | 'mensual';

export interface AppointmentServiceOption {
  id: string;
  nombre: string;
  duracion: number;
  activo?: boolean;
}

export interface AppointmentClientOption {
  id: string;
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
}

export function formatAppointmentDate(date: string | Date): string {
  return formatDBDate(date);
}

export function createEmptyAppointmentForm() {
  return {
    cliente_id: '',
    cliente_nombre: '',
    cliente_telefono: '',
    servicio_id: '',
    servicio_ids: [] as string[],
    servicio_duraciones: [] as number[],
    empleado_id: '',
    fecha: '',
    hora: '',
    notas: '',
  };
}

export type AppointmentForm = ReturnType<typeof createEmptyAppointmentForm>;

export function getBusinessTomorrowString(): string {
  const [year, month, day] = getBusinessTodayString().split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day));
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

export function isInCurrentBusinessWeek(dateString: string): boolean {
  const [year, month, day] = getBusinessTodayString().split('-').map(Number);
  const today = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = today.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startOfWeek = new Date(today);
  startOfWeek.setUTCDate(today.getUTCDate() - daysFromMonday);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);

  const [targetYear, targetMonth, targetDay] = dateString.split('-').map(Number);
  const targetTime = Date.UTC(targetYear, targetMonth - 1, targetDay);
  return targetTime >= startOfWeek.getTime() && targetTime <= endOfWeek.getTime();
}

export function isInCurrentBusinessMonth(dateString: string): boolean {
  const [currentYear, currentMonth] = getBusinessTodayString().split('-');
  const [targetYear, targetMonth] = dateString.split('-');
  return currentYear === targetYear && currentMonth === targetMonth;
}

export function isInRecentBusinessFortnight(dateString: string): boolean {
  const [year, month, day] = getBusinessTodayString().split('-').map(Number);
  const today = new Date(Date.UTC(year, month - 1, day));
  const fortnightStart = new Date(today);
  fortnightStart.setUTCDate(today.getUTCDate() - 14);

  const [targetYear, targetMonth, targetDay] = dateString.split('-').map(Number);
  const targetTime = Date.UTC(targetYear, targetMonth - 1, targetDay);
  return targetTime >= fortnightStart.getTime() && targetTime <= today.getTime();
}

export function sortAppointmentsByDate<T extends { fecha: string; hora: string }>(
  appointments: T[],
  ascending: boolean
): T[] {
  return [...appointments].sort((first, second) => {
    const firstDateTime = `${first.fecha.split('T')[0]}T${first.hora}`;
    const secondDateTime = `${second.fecha.split('T')[0]}T${second.hora}`;
    return ascending
      ? firstDateTime.localeCompare(secondDateTime)
      : secondDateTime.localeCompare(firstDateTime);
  });
}
