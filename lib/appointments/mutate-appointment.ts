import type { Prisma } from '@prisma/client';
import { parseLocalDateToUTC } from '@/lib/timezone';
import {
  calculateAppointmentAvailability,
  findAppointmentConflicts,
  validateExactAppointmentTime,
} from './appointment-availability';

const NON_EDITABLE_STATES = ['COMPLETADA', 'CANCELADA', 'NO_SHOW'];

function advisoryLockHash(empleadoId: string, fechaYYYYMMDD: string): bigint {
  const lockStr = `${empleadoId}_${fechaYYYYMMDD.split('T')[0]}`;
  let hash = BigInt(0);
  for (let i = 0; i < lockStr.length; i++) {
    hash = BigInt.asIntN(64, hash * BigInt(31) + BigInt(lockStr.charCodeAt(i)));
  }
  return hash;
}

export interface RescheduleAppointmentInput {
  citaId: string;
  targetEmpleadoId: string;
  fecha: string;
  hora: string;
  userId: string;
  userRole: string;
  expectedUpdatedAt?: string | null;
  serviciosParaCita?: { id: string; duracion: number }[];
  permitirHorarioExtendido?: boolean;
}

export async function rescheduleAppointmentInTransaction(
  tx: Prisma.TransactionClient,
  input: RescheduleAppointmentInput,
) {
  const {
    citaId,
    targetEmpleadoId,
    fecha,
    hora,
    userId,
    userRole,
    expectedUpdatedAt,
    serviciosParaCita,
    permitirHorarioExtendido = false,
  } = input;

  const normalizedDate = fecha.split('T')[0];
  const hash = advisoryLockHash(targetEmpleadoId, normalizedDate);
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${hash})`;
  await tx.$queryRaw`SELECT "id" FROM "Cita" WHERE "id" = ${citaId} FOR UPDATE`;

  const latest = await tx.cita.findUnique({
    where: { id: citaId },
    include: { citaServicios: { orderBy: { orden: 'asc' } } },
  });

  if (!latest) {
    return { error: 'La cita ya no existe.', status: 404 as const };
  }

  if (userRole === 'EMPLEADO') {
    if (latest.empleado_id !== userId) {
      return { error: 'No tienes permiso para reprogramar una cita que no te pertenece.', status: 403 as const };
    }
    if (targetEmpleadoId !== userId) {
      return { error: 'No tienes permiso para reasignar esta cita a otro profesional.', status: 403 as const };
    }
  }

  if (expectedUpdatedAt) {
    const expectedTime = new Date(expectedUpdatedAt).getTime();
    const serverTime = new Date(latest.updated_at).getTime();
    if (!Number.isNaN(expectedTime) && serverTime > expectedTime) {
      return {
        type: 'CONCURRENT_EDIT' as const,
        error: 'Esta cita fue modificada por otro usuario. Consulta de nuevo antes de reprogramarla.',
        status: 409 as const,
      };
    }
  }

  if (NON_EDITABLE_STATES.includes(latest.estado)) {
    return {
      error: `No se puede reprogramar una cita en estado ${latest.estado}.`,
      status: 422 as const,
    };
  }

  const targetEmpleado = await tx.empleado.findUnique({
    where: { id: targetEmpleadoId },
    select: { activo: true, esAgendable: true },
  });
  if (!targetEmpleado?.activo || !targetEmpleado.esAgendable) {
    return { error: 'El profesional seleccionado no está disponible para agendar citas.', status: 400 as const };
  }

  const duracionFinal = serviciosParaCita?.length
    ? serviciosParaCita.reduce((sum, service) => sum + service.duracion, 0)
    : latest.duracion;
  const primerServicioId = serviciosParaCita?.[0]?.id ?? latest.servicio_id;

  const conflictos = await findAppointmentConflicts(
    targetEmpleadoId,
    normalizedDate,
    hora,
    duracionFinal,
    citaId,
    tx,
  );
  const blocking = conflictos.filter(conflict => !conflict.allowOverlap);
  if (blocking.length > 0) {
    return {
      type: 'SCHEDULE_OVERLAP' as const,
      error: 'El horario se cruza con otra cita.',
      conflicts: blocking,
      status: 409 as const,
    };
  }

  const disponibilidad = await calculateAppointmentAvailability(
    targetEmpleadoId,
    normalizedDate,
    primerServicioId,
    duracionFinal,
    hora,
    citaId,
    permitirHorarioExtendido,
    tx,
  );

  if (!disponibilidad.disponible || !disponibilidad.jornada) {
    return {
      error: `El profesional no está disponible este día: ${disponibilidad.motivo || 'Sin jornada disponible'}`,
      status: 409 as const,
    };
  }

  const validacion = validateExactAppointmentTime(
    hora,
    duracionFinal,
    disponibilidad.jornada.inicio,
    disponibilidad.jornada.fin,
    disponibilidad.intervalosOcupados,
    permitirHorarioExtendido,
    disponibilidad.turnosEmpleado,
  );

  if (!validacion.valida) {
    return { error: `Hora no disponible: ${validacion.motivo}`, status: 409 as const };
  }

  if (serviciosParaCita?.length) {
    await tx.citaServicio.deleteMany({ where: { cita_id: citaId } });
    await tx.citaServicio.createMany({
      data: serviciosParaCita.map((service, index) => ({
        cita_id: citaId,
        servicio_id: service.id,
        duracion: service.duracion,
        orden: index,
      })),
    });
  }

  const updated = await tx.cita.update({
    where: { id: citaId },
    data: {
      fecha: parseLocalDateToUTC(normalizedDate),
      hora,
      empleado_id: targetEmpleadoId,
      ...(serviciosParaCita?.length ? { servicio_id: primerServicioId, duracion: duracionFinal } : {}),
      allowOverlap: false,
      overlapReason: null,
      overlapConfirmedById: null,
      overlapConfirmedAt: null,
    },
  });

  return { cita: updated, beforeData: latest, status: 200 as const };
}

export interface CancelAppointmentInput {
  citaId: string;
  userId: string;
  userRole: string;
  expectedUpdatedAt?: string | null;
  motivo?: string | null;
}

export async function cancelAppointmentInTransaction(
  tx: Prisma.TransactionClient,
  input: CancelAppointmentInput,
) {
  const { citaId, userId, userRole, expectedUpdatedAt, motivo } = input;
  await tx.$queryRaw`SELECT "id" FROM "Cita" WHERE "id" = ${citaId} FOR UPDATE`;

  const latest = await tx.cita.findUnique({ where: { id: citaId } });
  if (!latest) {
    return { error: 'La cita ya no existe.', status: 404 as const };
  }

  if (userRole === 'EMPLEADO' && latest.empleado_id !== userId) {
    return { error: 'No tienes permiso para cancelar una cita que no te pertenece.', status: 403 as const };
  }

  if (expectedUpdatedAt) {
    const expectedTime = new Date(expectedUpdatedAt).getTime();
    const serverTime = new Date(latest.updated_at).getTime();
    if (!Number.isNaN(expectedTime) && serverTime > expectedTime) {
      return {
        type: 'CONCURRENT_EDIT' as const,
        error: 'Esta cita fue modificada por otro usuario. Consulta de nuevo antes de cancelarla.',
        status: 409 as const,
      };
    }
  }

  if (NON_EDITABLE_STATES.includes(latest.estado)) {
    return {
      error: `La cita ya está en estado ${latest.estado} y no se puede cancelar.`,
      status: 422 as const,
    };
  }

  const updated = await tx.cita.update({
    where: { id: citaId },
    data: {
      estado: 'CANCELADA',
      cancelled_at: new Date(),
      cancel_reason: motivo?.trim() || 'Cancelada desde el asistente con confirmación en pantalla',
    },
  });

  return { cita: updated, beforeData: latest, status: 200 as const };
}
