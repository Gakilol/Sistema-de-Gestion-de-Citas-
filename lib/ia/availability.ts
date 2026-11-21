import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { calculateAppointmentAvailability, timeToMinutes } from '@/lib/appointments/appointment-availability';
import { getBusinessNowTime, getBusinessTodayString } from '@/lib/timezone';
import { validateNormalBusinessTime } from '@/lib/time-utils';
import { addDays } from './intent';
import type { EmployeeOption, OfferedSlot, ServiceOption, TimeOfDayWindow } from './domain';

type Db = Prisma.TransactionClient;

export function matchesTimeWindow(hora: string, franja?: TimeOfDayWindow | null): boolean {
  if (!franja) return true;
  if (franja === 'manana') return hora < '12:00';
  if (franja === 'tarde') return hora >= '12:00' && hora <= '18:00';
  return hora >= '18:00';
}

export function timeWindowLabel(franja: TimeOfDayWindow): string {
  if (franja === 'manana') return 'por la mañana';
  if (franja === 'tarde') return 'por la tarde';
  return 'por la noche';
}

export function pickConversationalSlots(
  slots: OfferedSlot[],
  durationMinutes: number,
  maxCount = 5,
): OfferedSlot[] {
  const uniqueByTime = new Map<string, OfferedSlot>();
  for (const slot of slots) {
    const key = `${slot.fecha}_${slot.hora}`;
    if (!uniqueByTime.has(key)) {
      uniqueByTime.set(key, slot);
    }
  }
  const deduped = [...uniqueByTime.values()].sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || timeToMinutes(a.hora) - timeToMinutes(b.hora),
  );
  if (deduped.length <= maxCount) return deduped;

  const spacing = Math.max(30, Math.min(durationMinutes || 30, 60));
  const picked: OfferedSlot[] = [];
  const chosenKeys = new Set<string>();

  const trySelect = (candidates: OfferedSlot[], minGap: number) => {
    for (const slot of candidates) {
      if (picked.length >= maxCount) break;
      const key = `${slot.fecha}_${slot.hora}`;
      if (chosenKeys.has(key)) continue;
      const slotMin = timeToMinutes(slot.hora);
      const tooClose = picked.some(
        existing => existing.fecha === slot.fecha && Math.abs(timeToMinutes(existing.hora) - slotMin) < minGap,
      );
      if (tooClose) continue;
      picked.push(slot);
      chosenKeys.add(key);
    }
  };

  // Prefer clean :00 and :30 boundaries first for natural spoken options
  const cleanMarks = deduped.filter(slot => slot.hora.endsWith(':00') || slot.hora.endsWith(':30'));
  trySelect(cleanMarks, spacing);
  if (picked.length < maxCount) trySelect(cleanMarks, 30);
  if (picked.length < maxCount) trySelect(deduped, 30);
  if (picked.length < maxCount) trySelect(deduped, 0);

  return picked.sort((a, b) => a.fecha.localeCompare(b.fecha) || timeToMinutes(a.hora) - timeToMinutes(b.hora));
}

async function getDaySlotsForEmployees(
  employees: EmployeeOption[],
  fecha: string,
  servicios: ServiceOption[],
  excludeCitaId?: string | null,
  db: Db = prisma,
): Promise<OfferedSlot[]> {
  if (!employees.length || !servicios.length) return [];
  const today = getBusinessTodayString();
  if (fecha < today) return [];
  const nowTime = fecha === today ? getBusinessNowTime() : null;
  const totalDuration = servicios.reduce((sum, service) => sum + service.duracion, 0);
  const firstServiceId = servicios[0].id;

  const results = await Promise.all(
    employees.map(async employee => {
      const availability = await calculateAppointmentAvailability(
        employee.id,
        fecha,
        firstServiceId,
        totalDuration,
        null,
        excludeCitaId ?? null,
        false,
        db,
      );
      if (!availability.disponible) return [] as OfferedSlot[];
      return availability.bloques
        .filter(slot => slot.disponible && (!nowTime || slot.hora > nowTime))
        .map(slot => ({
          fecha,
          hora: slot.hora,
          empleadoId: employee.id,
          empleadoNombre: employee.nombre,
        }));
    }),
  );

  return results.flat();
}

export interface FindSlotsParams {
  employees: EmployeeOption[];
  preferredEmployeeId?: string | null;
  fecha: string;
  franja?: TimeOfDayWindow | null;
  servicios: ServiceOption[];
  excludeCitaId?: string | null;
  maxOptions?: number;
  searchFutureDays?: boolean;
  db?: Db;
}

export interface FindSlotsResult {
  status: 'exact_window' | 'exact_day' | 'same_day_other_window' | 'next_days' | 'none';
  options: OfferedSlot[];
  allMatching: OfferedSlot[];
}

export async function findRealSlotOptions(params: FindSlotsParams): Promise<FindSlotsResult> {
  const {
    employees,
    preferredEmployeeId,
    fecha,
    franja,
    servicios,
    excludeCitaId,
    maxOptions = 5,
    searchFutureDays = true,
    db = prisma,
  } = params;

  const targetEmployees = preferredEmployeeId
    ? employees.filter(employee => employee.id === preferredEmployeeId)
    : employees;
  if (!targetEmployees.length || !servicios.length) {
    return { status: 'none', options: [], allMatching: [] };
  }

  const totalDuration = servicios.reduce((sum, service) => sum + service.duracion, 0);
  const daySlots = await getDaySlotsForEmployees(targetEmployees, fecha, servicios, excludeCitaId, db);

  if (franja) {
    const windowSlots = daySlots.filter(slot => matchesTimeWindow(slot.hora, franja));
    if (windowSlots.length > 0) {
      return {
        status: 'exact_window',
        options: pickConversationalSlots(windowSlots, totalDuration, maxOptions),
        allMatching: windowSlots,
      };
    }
    if (daySlots.length > 0) {
      return {
        status: 'same_day_other_window',
        options: pickConversationalSlots(daySlots, totalDuration, maxOptions),
        allMatching: daySlots,
      };
    }
  } else if (daySlots.length > 0) {
    return {
      status: 'exact_day',
      options: pickConversationalSlots(daySlots, totalDuration, maxOptions),
      allMatching: daySlots,
    };
  }

  if (!searchFutureDays) {
    return { status: 'none', options: [], allMatching: [] };
  }

  const today = getBusinessTodayString();
  const baseDate = fecha < today ? today : fecha;
  const collected: OfferedSlot[] = [];

  for (let offset = 1; offset <= 7 && collected.length < maxOptions; offset++) {
    const nextDate = addDays(baseDate, offset);
    const nextDaySlots = await getDaySlotsForEmployees(targetEmployees, nextDate, servicios, excludeCitaId, db);
    if (!nextDaySlots.length) continue;

    const preferred = franja ? nextDaySlots.filter(slot => matchesTimeWindow(slot.hora, franja)) : nextDaySlots;
    const pool = preferred.length ? preferred : nextDaySlots;
    const pickedForDay = pickConversationalSlots(pool, totalDuration, Math.min(3, maxOptions - collected.length));
    collected.push(...pickedForDay);
  }

  if (collected.length > 0) {
    return { status: 'next_days', options: collected.slice(0, maxOptions), allMatching: collected };
  }

  return { status: 'none', options: [], allMatching: [] };
}

export interface CheckSlotParams {
  employees: EmployeeOption[];
  preferredEmployeeId?: string | null;
  fecha: string;
  hora: string;
  horaAmbigua?: boolean;
  franja?: TimeOfDayWindow | null;
  servicios: ServiceOption[];
  excludeCitaId?: string | null;
  db?: Db;
}

export type CheckSlotResult =
  | { kind: 'available'; slot: OfferedSlot }
  | { kind: 'ambiguous_ampm'; hour12: number; minute: number }
  | { kind: 'past'; resolvedHora: string; alternatives: FindSlotsResult }
  | { kind: 'unavailable'; resolvedHora: string; reason: string; alternatives: FindSlotsResult };

export function resolveAmbiguousHour(
  hora: string,
  horaAmbigua?: boolean,
  franja?: TimeOfDayWindow | null,
): { resolved: string } | { ambiguous: true; hour12: number; minute: number } {
  if (!horaAmbigua) return { resolved: hora };
  const [rawH, m] = hora.split(':').map(Number);
  const hour12 = rawH === 0 ? 12 : rawH > 12 ? rawH - 12 : rawH;
  const amHour = hour12 === 12 ? 0 : hour12;
  const pmHour = hour12 === 12 ? 12 : hour12 + 12;
  const amStr = `${String(amHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const pmStr = `${String(pmHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  if (franja === 'tarde' && pmHour <= 18) return { resolved: pmStr };
  if (franja === 'noche' && pmHour >= 18) return { resolved: pmStr };
  if (franja === 'manana' && amHour < 12) return { resolved: amStr };

  const amNormal = validateNormalBusinessTime(amStr).valid;
  const pmNormal = validateNormalBusinessTime(pmStr).valid;
  if (pmNormal && !amNormal) return { resolved: pmStr };
  if (amNormal && !pmNormal) return { resolved: amStr };
  return { ambiguous: true, hour12, minute: m };
}

export async function checkSpecificSlot(params: CheckSlotParams): Promise<CheckSlotResult> {
  const {
    employees,
    preferredEmployeeId,
    fecha,
    hora,
    horaAmbigua,
    franja,
    servicios,
    excludeCitaId,
    db = prisma,
  } = params;

  const resolved = resolveAmbiguousHour(hora, horaAmbigua, franja);
  if ('ambiguous' in resolved) {
    return { kind: 'ambiguous_ampm', hour12: resolved.hour12, minute: resolved.minute };
  }

  const resolvedHora = resolved.resolved;
  const today = getBusinessTodayString();
  const nowTime = getBusinessNowTime();
  if (fecha < today || (fecha === today && resolvedHora <= nowTime)) {
    const alternatives = await findRealSlotOptions({
      employees,
      preferredEmployeeId,
      fecha: fecha < today ? today : fecha,
      franja,
      servicios,
      excludeCitaId,
      db,
    });
    return { kind: 'past', resolvedHora, alternatives };
  }

  const orderedEmployees = preferredEmployeeId
    ? employees.filter(employee => employee.id === preferredEmployeeId)
    : employees;
  const totalDuration = servicios.reduce((sum, service) => sum + service.duracion, 0);
  const firstServiceId = servicios[0].id;
  let lastReason = 'Ese horario no está disponible.';

  for (const employee of orderedEmployees) {
    const availability = await calculateAppointmentAvailability(
      employee.id,
      fecha,
      firstServiceId,
      totalDuration,
      resolvedHora,
      excludeCitaId ?? null,
      false,
      db,
    );
    if (!availability.disponible) {
      if (availability.motivo) lastReason = availability.motivo;
      continue;
    }
    const matchingBlock = availability.bloques.find(slot => slot.hora === resolvedHora);
    if (matchingBlock?.disponible) {
      return {
        kind: 'available',
        slot: {
          fecha,
          hora: resolvedHora,
          empleadoId: employee.id,
          empleadoNombre: employee.nombre,
        },
      };
    }
    if (matchingBlock?.motivo) lastReason = matchingBlock.motivo;
  }

  const alternatives = await findRealSlotOptions({
    employees,
    preferredEmployeeId,
    fecha,
    franja,
    servicios,
    excludeCitaId,
    db,
  });

  return { kind: 'unavailable', resolvedHora, reason: lastReason, alternatives };
}
