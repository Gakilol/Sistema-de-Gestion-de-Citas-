import { prisma } from './db';
import { EstadoCita } from '@prisma/client';

/**
 * Sincroniza automáticamente los estados de las citas elegibles en base a la hora actual de America/Managua (UTC-6).
 * Las citas 'CANCELADA' y 'REPROGRAMADA' quedan totalmente excluidas de esta automatización.
 */
export async function syncCitaEstados(): Promise<void> {
  try {
    // 1. Obtener la hora actual de America/Managua (UTC-6) de forma timezone-safe
    const nowInManagua = new Date(Date.now() - 6 * 60 * 60 * 1000);

    // 2. Consultar citas activas que estén en un estado automatizable
    const citasActivas = await prisma.cita.findMany({
      where: {
        estado: {
          in: [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA, EstadoCita.EN_PROGRESO]
        }
      }
    });

    if (citasActivas.length === 0) {
      return;
    }

    const updates: Promise<any>[] = [];

    for (const cita of citasActivas) {
      // Reconstruir la fecha y hora de inicio de la cita en formato UTC-6 plano
      const startOfCita = new Date(cita.fecha.getTime());
      const [hours, minutes] = cita.hora.split(':').map(Number);
      startOfCita.setUTCHours(hours, minutes, 0, 0);

      // Calcular el fin de la cita en minutos
      const endOfCita = new Date(startOfCita.getTime() + cita.duracion * 60 * 1000);

      let targetEstado = cita.estado;

      if (nowInManagua < startOfCita) {
        // Si aún no ha iniciado, conservar PENDIENTE o CONFIRMADA.
        // Si por algún motivo estaba en EN_PROGRESO, restablecer a PENDIENTE.
        if (cita.estado !== EstadoCita.PENDIENTE && cita.estado !== EstadoCita.CONFIRMADA) {
          targetEstado = EstadoCita.PENDIENTE;
        }
      } else if (nowInManagua >= startOfCita && nowInManagua < endOfCita) {
        // Cita en curso
        targetEstado = EstadoCita.EN_PROGRESO;
      } else if (nowInManagua >= endOfCita) {
        // Cita finalizada
        targetEstado = EstadoCita.COMPLETADA;
      }

      // Si hay transición de estado, programar actualización
      if (targetEstado !== cita.estado) {
        console.log(`[AUTOMATIZACIÓN] Transición de estado: Cita ${cita.id} de "${cita.cliente_nombre}" (${cita.fecha.toISOString().split('T')[0]} ${cita.hora}) [${cita.estado} -> ${targetEstado}]`);
        updates.push(
          prisma.cita.update({
            where: { id: cita.id },
            data: { estado: targetEstado }
          })
        );
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`[AUTOMATIZACIÓN] Sincronización finalizada. ${updates.length} citas actualizadas.`);
    }
  } catch (error) {
    console.error('[AUTOMATIZACIÓN] Error crítico al sincronizar estados de citas:', error);
  }
}
