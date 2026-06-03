import { prisma } from '@/lib/db';

export type AccionAuditoria = 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR' | 'CANCELAR' | 'FORZAR';

interface RegistrarAuditoriaParams {
  entidad: string;           // 'Cita', 'Empleado', 'Servicio', etc.
  entidadId: string;
  accion: AccionAuditoria;
  detalles?: Record<string, any>;
  realizadoPor?: string | null;
}

/**
 * Registra una acción administrativa en la tabla AuditLog.
 * Se invoca desde las rutas de API en operaciones críticas.
 * No lanza error: la auditoría no debe interrumpir la operación principal.
 */
export async function registrarAuditoria({
  entidad,
  entidadId,
  accion,
  detalles,
  realizadoPor,
}: RegistrarAuditoriaParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entidad,
        entidadId,
        accion,
        detalles: detalles !== undefined ? detalles : undefined,
        realizadoPor: realizadoPor ?? null,
      },
    });
  } catch (err) {
    // Silenciar el error: la auditoría nunca debe bloquear la operación principal
    console.error('[AuditLog] Error al registrar:', err);
  }
}
