import type { Prisma } from '@prisma/client';
import { parseLocalDateToUTC } from '@/lib/timezone';
import { calculateAppointmentAvailability, validateExactAppointmentTime, findAppointmentConflicts } from './appointment-availability';

export interface AppointmentCreationInput {
  finalEmpleadoId: string; fecha: string; primerServicioId: string; duracionCalculada: number; hora: string;
  permitirHorarioExtendido: boolean; allowOverlap?: boolean; userRole: string; userId: string;
  serviciosParaCita: { id: string; duracion: number }[];
  idClienteFinal: string | null; finalClienteNombre: string; finalClienteTelefono: string | null;
  notas?: string | null; overlapReason?: string | null;
}

/** Shared atomic writer: the caller owns the transaction; every path uses the same professional/day lock. */
export async function createAppointmentInTransaction(tx: Prisma.TransactionClient, input: AppointmentCreationInput) {
  const { finalEmpleadoId, fecha, primerServicioId, duracionCalculada, hora, permitirHorarioExtendido, allowOverlap, userRole, userId, serviciosParaCita, idClienteFinal, finalClienteNombre, finalClienteTelefono, notas, overlapReason } = input;
  // Bloqueo asesor de PostgreSQL para evitar carreras concurrentes en la misma fecha y estilista
  const lockStr = `${finalEmpleadoId}_${fecha.split('T')[0]}`;
  let hash = BigInt(0);
  for (let i = 0; i < lockStr.length; i++) {
    hash = BigInt.asIntN(64, (hash * BigInt(31)) + BigInt(lockStr.charCodeAt(i)));
  }
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${hash})`;

  const disponibilidad = await calculateAppointmentAvailability(
    finalEmpleadoId,
    fecha.split('T')[0],
    primerServicioId,
    duracionCalculada,
    hora,
    null,
    permitirHorarioExtendido,
    tx
  );

  if (!disponibilidad.disponible) {
    return { error: 'El empleado no está disponible este día: ' + disponibilidad.motivo, status: 400 };
  }

  if (!disponibilidad.jornada) {
    return { error: 'No se pudo determinar la jornada laboral', status: 400 };
  }

  const conflictos = await findAppointmentConflicts(
    finalEmpleadoId,
    fecha.split('T')[0],
    hora,
    duracionCalculada,
    null,
    tx
  );

  const isOverlapRequested = allowOverlap === true;
  const conflictosBloqueantes = conflictos.filter(c => !c.allowOverlap);

  if (conflictosBloqueantes.length > 0) {
    if (!isOverlapRequested) {
      return {
        type: 'SCHEDULE_OVERLAP',
        message: 'El horario se cruza con otra cita.',
        conflicts: conflictosBloqueantes,
        status: 409
      };
    }

    if (userRole === 'EMPLEADO' && finalEmpleadoId !== userId) {
      return { error: 'No tienes permiso para crear traslapes en la agenda de otros empleados.', status: 403 };
    }
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT' && userRole !== 'EMPLEADO') {
      return { error: 'No tienes permiso para confirmar traslapes.', status: 403 };
    }
  }

  const intervalosFiltrados = (conflictosBloqueantes.length > 0 && isOverlapRequested)
    ? disponibilidad.intervalosOcupados.filter(int => int.motivo !== 'Cita reservada')
    : disponibilidad.intervalosOcupados;

  const validacion = validateExactAppointmentTime(
    hora,
    duracionCalculada,
    disponibilidad.jornada.inicio,
    disponibilidad.jornada.fin,
    intervalosFiltrados,
    permitirHorarioExtendido,
    disponibilidad.turnosEmpleado
  );

  if (!validacion.valida) {
    return { error: 'Hora no disponible: ' + validacion.motivo, status: 400 };
  }

  const hasConflict = conflictosBloqueantes.length > 0;
  const c = await tx.cita.create({
    data: {
      cliente_id:       idClienteFinal,
      cliente_nombre:   finalClienteNombre.trim(),
      cliente_telefono: finalClienteTelefono?.trim() || null,
      servicio_id:      primerServicioId,
      empleado_id:      finalEmpleadoId,
      fecha:            parseLocalDateToUTC(fecha.split('T')[0]),
      hora,
      duracion:         duracionCalculada,
      notas,
      created_by:       userId,
      allowOverlap:     hasConflict && isOverlapRequested,
      overlapReason:    hasConflict && isOverlapRequested ? overlapReason : null,
      overlapConfirmedById: hasConflict && isOverlapRequested ? userId : null,
      overlapConfirmedAt:   hasConflict && isOverlapRequested ? new Date() : null,
    },
  });

  await tx.citaServicio.createMany({
    data: serviciosParaCita.map((s, index) => ({
      cita_id:     c.id,
      servicio_id: s.id,
      duracion:    s.duracion,
      orden:       index,
    }))
  });

  return { cita: c, conflictos, status: 201 };
}
