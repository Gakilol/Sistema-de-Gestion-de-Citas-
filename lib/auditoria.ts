import { logAudit } from './audit/audit-logger';

export type AccionAuditoria = 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR' | 'CANCELAR' | 'FORZAR';

interface RegistrarAuditoriaParams {
  entidad: string;           // 'Cita', 'Empleado', 'Servicio', etc.
  entidadId: string;
  accion: AccionAuditoria | string;
  detalles?: Record<string, any>;
  realizadoPor?: string | null;
}

/**
 * Registra una acción administrativa en la tabla AuditLog (compatibilidad heredada).
 */
export async function registrarAuditoria({
  entidad,
  entidadId,
  accion,
  detalles,
  realizadoPor,
}: RegistrarAuditoriaParams): Promise<void> {
  let mappedAction = 'SYSTEM_ACTION';
  if (accion === 'CREAR') mappedAction = `${entidad.toUpperCase()}_CREATED`;
  else if (accion === 'ACTUALIZAR') mappedAction = `${entidad.toUpperCase()}_UPDATED`;
  else if (accion === 'ELIMINAR') mappedAction = `${entidad.toUpperCase()}_DELETED`;
  else if (accion === 'CANCELAR') mappedAction = `${entidad.toUpperCase()}_CANCELLED`;
  else mappedAction = accion;

  await logAudit({
    action: mappedAction,
    module: entidad.toUpperCase(),
    entityType: entidad,
    entityId: entidadId,
    status: 'SUCCESS',
    description: `Acción legacy: ${accion} sobre ${entidad}`,
    userEmail: realizadoPor,
    metadata: detalles
  });
}

