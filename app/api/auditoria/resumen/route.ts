import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAuditAuth } from '@/lib/audit/audit-auth';
import { startOfDay, startOfWeek } from 'date-fns';

export async function GET(req: NextRequest) {
  const auth = checkAuditAuth(req);
  if ('error' in auth) return auth.error;

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Lunes

  try {
    // Para no hacer N consultas pesadas o N+1, usamos Promise.all para paralelizar
    const [
      totalActions,
      activeUsersCount,
      loginSuccessCount,
      loginFailedCount,
      configChangesCount,
      roleChangesCount,
      citasCreatedCount,
      citasCancelledCount,
      citasRescheduledCount,
      exportationsCount,
      backupCount,
      restoreCount,
      blockedAccessCount,
      criticalErrorsCount,
      actionsToday,
      actionsThisWeek
    ] = await Promise.all([
      // Total acciones
      prisma.auditLog.count(),
      // Usuarios activos (últimos 7 días)
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          userId: { not: null }
        }
      }).then(res => res.length),
      // Inicios de sesión exitosos
      prisma.auditLog.count({ where: { action: 'LOGIN_SUCCESS' } }),
      // Inicios de sesión fallidos
      prisma.auditLog.count({ where: { action: 'LOGIN_FAILED' } }),
      // Cambios de configuración
      prisma.auditLog.count({ where: { module: 'CONFIGURACION' } }),
      // Cambios de roles
      prisma.auditLog.count({ where: { action: 'ROLE_CHANGED' } }),
      // Citas creadas
      prisma.auditLog.count({ where: { action: 'APPOINTMENT_CREATED' } }),
      // Citas canceladas
      prisma.auditLog.count({ where: { action: 'APPOINTMENT_CANCELLED' } }),
      // Citas reprogramadas
      prisma.auditLog.count({ where: { action: 'APPOINTMENT_RESCHEDULED' } }),
      // Exportaciones
      prisma.auditLog.count({ where: { action: 'AUDIT_LOG_EXPORTED' } }),
      // Backups
      prisma.auditLog.count({ where: { action: 'BACKUP_COMPLETED' } }),
      // Restauraciones
      prisma.auditLog.count({ where: { action: 'BACKUP_RESTORE_COMPLETED' } }),
      // Accesos bloqueados
      prisma.auditLog.count({ where: { action: { in: ['UNAUTHORIZED_ACCESS_ATTEMPT', 'FORBIDDEN_API_ACCESS'] } } }),
      // Errores críticos
      prisma.auditLog.count({ where: { status: 'FAILED' } }),
      // Acciones hoy
      prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      // Acciones esta semana
      prisma.auditLog.count({ where: { createdAt: { gte: weekStart } } })
    ]);

    return NextResponse.json({
      totalActions,
      activeUsersCount,
      loginSuccessCount,
      loginFailedCount,
      configChangesCount,
      roleChangesCount,
      citasCreatedCount,
      citasCancelledCount,
      citasRescheduledCount,
      exportationsCount,
      backupCount,
      restoreCount,
      blockedAccessCount,
      criticalErrorsCount,
      actionsToday,
      actionsThisWeek
    });
  } catch (err: any) {
    console.error('[/api/auditoria/resumen]', err);
    return NextResponse.json({ error: 'Error al generar resumen de auditoría.' }, { status: 500 });
  }
}
