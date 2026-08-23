import { prisma } from '@/lib/db';
import { BUSINESS_TIMEZONE } from '@/lib/timezone';
import { EstadoCita, Prisma } from '@prisma/client';

export function getNowInBusinessTZ(reference = new Date()): Date {
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
  const parts = formatter.formatToParts(reference);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return new Date(
    `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}Z`
  );
}

interface AppointmentStatusInput {
  fecha: Date;
  hora: string;
  duracion: number;
  estado: EstadoCita;
}

export function getAutomaticAppointmentStatus(
  appointment: AppointmentStatusInput,
  nowLocal: Date
): { status: EstadoCita; completedAt?: Date } {
  const date = appointment.fecha.toISOString().split('T')[0];
  const [hours, minutes] = appointment.hora.split(':').map(Number);
  const start = new Date(
    `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`
  );
  const end = new Date(start.getTime() + appointment.duracion * 60_000);

  if (nowLocal < start) {
    return {
      status: appointment.estado === EstadoCita.CONFIRMADA
        ? EstadoCita.CONFIRMADA
        : EstadoCita.PENDIENTE,
    };
  }
  if (nowLocal < end) return { status: EstadoCita.EN_PROGRESO };
  return { status: EstadoCita.COMPLETADA, completedAt: end };
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
    const planned = getAutomaticAppointmentStatus(appointment, nowLocal);
    const target = planned.status;

    if (target !== appointment.estado) {
      changes.push({
        id: appointment.id,
        before: appointment.estado,
        after: target,
        completedAt:
          target === EstadoCita.COMPLETADA && !appointment.completed_at
            ? planned.completedAt
            : undefined,
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
