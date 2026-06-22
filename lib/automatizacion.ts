import { prisma } from './db';
import { EstadoCita } from '@prisma/client';

const BUSINESS_TIMEZONE = 'America/Costa_Rica';

/**
 * Obtiene la fecha y hora actuales en la zona horaria del negocio (Costa Rica UTC-6).
 * Retorna un objeto Date con la hora "local" expresada en UTC para comparaciones consistentes.
 */
function getNowInBusinessTZ(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  const localIso = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`;
  return new Date(localIso);
}

/**
 * Sincroniza automáticamente los estados de las citas elegibles en base a la hora actual de Costa Rica.
 * Las citas 'CANCELADA' y 'REPROGRAMADA' quedan totalmente excluidas de esta automatización.
 */
export async function syncCitaEstados(): Promise<void> {
  try {
    // 1. Hora actual en la zona horaria del negocio (como UTC-neutral para comparar)
    const nowLocal = getNowInBusinessTZ();

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
      // Construir la fecha de la cita como string YYYY-MM-DD en UTC (el campo @db.Date
      // se guarda como medianoche UTC, que equivale exactamente al día en Costa Rica)
      const fechaStr = cita.fecha.toISOString().split('T')[0];
      const [hours, minutes] = cita.hora.split(':').map(Number);

      // Reconstruir inicio y fin de la cita en la misma escala que nowLocal
      const startOfCita = new Date(`${fechaStr}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00Z`);
      const endOfCita   = new Date(startOfCita.getTime() + cita.duracion * 60 * 1000);

      let targetEstado = cita.estado;

      if (nowLocal < startOfCita) {
        // Aún no ha iniciado: conservar PENDIENTE o CONFIRMADA
        if (cita.estado !== EstadoCita.PENDIENTE && cita.estado !== EstadoCita.CONFIRMADA) {
          targetEstado = EstadoCita.PENDIENTE;
        }
      } else if (nowLocal >= startOfCita && nowLocal < endOfCita) {
        // Cita en curso
        targetEstado = EstadoCita.EN_PROGRESO;
      } else if (nowLocal >= endOfCita) {
        // Cita finalizada
        targetEstado = EstadoCita.COMPLETADA;
      }

      if (targetEstado !== cita.estado) {
        console.log(`[AUTOMATIZACIÓN] ${cita.id} "${cita.cliente_nombre}" ${fechaStr} ${cita.hora}: ${cita.estado} → ${targetEstado}`);
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
      console.log(`[AUTOMATIZACIÓN] ${updates.length} citas actualizadas.`);
    }
  } catch (error) {
    console.error('[AUTOMATIZACIÓN] Error crítico al sincronizar estados de citas:', error);
  }
}
