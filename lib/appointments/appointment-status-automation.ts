import { prisma } from '@/lib/db';
import { BUSINESS_TIMEZONE } from '@/lib/timezone';
import { EstadoCita, Prisma } from '@prisma/client';

function getNowInBusinessTZ(): Date {
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
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`
  );
}

export interface AppointmentStatusSyncResult {
  inspected: number;
  updated: number;
}

export async function syncAppointmentStatuses(
  actor: { userId?: string | null; userRole?: string | null } = {}
): Promise<AppointmentStatusSyncResult> {
  const nowLocal = getNowInBusinessTZ();
  const appointments = await prisma.cita.findMany({
    where: {
      estado: {
        in: [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA, EstadoCita.EN_PROGRESO],
      },
    },
    select: {
      id: true,
      fecha: true,
      hora: true,
      duracion: true,
      estado: true,
      completed_at: true,
    },
  });

  const changes: Array<{
    id: string;
    before: EstadoCita;
    after: EstadoCita;
    completedAt?: Date;
  }> = [];

  for (const appointment of appointments) {
    const date = appointment.fecha.toISOString().split('T')[0];
    const [hours, minutes] = appointment.hora.split(':').map(Number);
    const start = new Date(
      `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`
    );
    const end = new Date(start.getTime() + appointment.duracion * 60_000);

    let target = appointment.estado;
    if (nowLocal < start) {
      if (![EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA].includes(appointment.estado)) {
        target = EstadoCita.PENDIENTE;
      }
    } else if (nowLocal < end) {
      target = EstadoCita.EN_PROGRESO;
    } else {
      target = EstadoCita.COMPLETADA;
    }

    if (target !== appointment.estado) {
      changes.push({
        id: appointment.id,
        before: appointment.estado,
        after: target,
        completedAt:
          target === EstadoCita.COMPLETADA && !appointment.completed_at ? end : undefined,
      });
    }
  }

  if (changes.length === 0) return { inspected: appointments.length, updated: 0 };

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let applied = 0;
    for (const change of changes) {
      const result = await tx.cita.updateMany({
        where: { id: change.id, estado: change.before },
        data: {
          estado: change.after,
          ...(change.completedAt ? { completed_at: change.completedAt } : {}),
        },
      });
      if (result.count === 0) continue;

      applied += 1;
      await tx.auditLog.create({
        data: {
          entidad: 'Cita',
          entidadId: change.id,
          accion: 'ESTADO_AUTOMATICO',
          realizadoPor: actor.userId ?? 'System',
          detalles: { before: change.before, after: change.after },
          userId: actor.userId ?? null,
          userRole: actor.userRole ?? null,
          action: 'APPOINTMENT_STATUS_AUTO_UPDATED',
          module: 'CITAS',
          entityType: 'Cita',
          entityId: change.id,
          description: 'Estado actualizado por sincronizacion controlada',
          status: 'SUCCESS',
          beforeData: { estado: change.before },
          afterData: { estado: change.after },
          metadata: { source: 'controlled-sync' },
        },
      });
    }
    return applied;
  });

  return { inspected: appointments.length, updated };
}
