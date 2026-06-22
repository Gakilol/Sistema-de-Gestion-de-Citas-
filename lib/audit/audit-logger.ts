import { prisma } from '@/lib/db';
import { sanitizeAuditData } from './sanitize-audit-data';

export interface AuditLogOptions {
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;      // E.g., 'LOGIN_SUCCESS', 'APPOINTMENT_CREATED'
  module: string;      // E.g., 'AUTH', 'CITAS', 'CLIENTES'
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  description?: string | null;
  status: 'SUCCESS' | 'FAILED';
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  beforeData?: any;
  afterData?: any;
  metadata?: any;
  errorMessage?: string | null;
}

/**
 * Extracts and sanitizes user IP address from headers
 */
export function getClientIp(headers: any): string {
  let ip = '';
  
  if (typeof headers.get === 'function') {
    // Headers object (like NextRequest headers)
    const forwardedFor = headers.get('x-forwarded-for');
    if (forwardedFor) {
      ip = forwardedFor.split(',')[0].trim();
    } else {
      ip = headers.get('x-real-ip') || '';
    }
  } else {
    // Plain object (like req.headers in API routes)
    const rawForwarded = headers['x-forwarded-for'];
    if (rawForwarded) {
      const forwardedStr = Array.isArray(rawForwarded) ? rawForwarded[0] : rawForwarded;
      ip = forwardedStr.split(',')[0].trim();
    } else {
      const realIp = headers['x-real-ip'];
      ip = (Array.isArray(realIp) ? realIp[0] : realIp) || '';
    }
  }

  // Mask IP for privacy (e.g. 192.168.1.1 -> 192.168.xxx.xxx)
  if (ip) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    // IPv6 masking
    const ipv6Parts = ip.split(':');
    if (ipv6Parts.length > 2) {
      return `${ipv6Parts[0]}:${ipv6Parts[1]}:xxxx:xxxx::`;
    }
  }
  
  return ip || '127.0.0.xxx';
}

/**
 * Writes an audit entry to the database. Sanitizes beforeData, afterData, and metadata.
 * Does not throw errors, to avoid interrupting business operations.
 */
export async function logAudit(options: AuditLogOptions): Promise<void> {
  // Prevent infinite loops by not logging reads/writes to AuditLog itself
  if (options.module === 'AUDITORIA' && (options.action.startsWith('AUDIT_LOG_VIEWED') || options.action.startsWith('AUDIT_LOG_FETCHED'))) {
    return;
  }

  try {
    const sanitizedBefore = options.beforeData ? sanitizeAuditData(options.beforeData) : null;
    const sanitizedAfter = options.afterData ? sanitizeAuditData(options.afterData) : null;
    const sanitizedMetadata = options.metadata ? sanitizeAuditData(options.metadata) : null;

    // For compatibility with the old schema:
    const oldEntidad = options.entityType || options.module;
    const oldEntidadId = options.entityId || 'N/A';
    const oldAccion = options.action;
    const oldRealizadoPor = options.userEmail || options.userName || 'System';

    await prisma.auditLog.create({
      data: {
        // Old fields
        entidad: oldEntidad,
        entidadId: oldEntidadId,
        accion: oldAccion,
        detalles: sanitizedMetadata || {},
        realizadoPor: oldRealizadoPor,
        fecha: new Date(),

        // New fields
        userId: options.userId || null,
        userName: options.userName || null,
        userEmail: options.userEmail || null,
        userRole: options.userRole || null,
        action: options.action,
        module: options.module,
        entityType: options.entityType || null,
        entityId: options.entityId || null,
        entityName: options.entityName || null,
        description: options.description || null,
        status: options.status,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        requestId: options.requestId || null,
        beforeData: sanitizedBefore,
        afterData: sanitizedAfter,
        metadata: sanitizedMetadata,
        errorMessage: options.errorMessage || null,
        createdAt: new Date()
      }
    });
  } catch (err) {
    console.error('[logAudit] Failed to write audit log:', err);
  }
}

/**
 * Maps legacy fields of an audit log object to the new schema fields if the new fields are null.
 */
export function mapLegacyAuditLog(log: any, employeesMap?: Map<string, any>): any {
  if (!log) return log;

  const mapped = { ...log };

  // Fallback dates
  if (!mapped.createdAt && mapped.fecha) {
    mapped.createdAt = mapped.fecha;
  }

  // Fallback status (legacy successful operations had status = null, default to SUCCESS)
  if (!mapped.status) {
    mapped.status = 'SUCCESS';
  }

  // Fallback module from entidad
  if (!mapped.module && mapped.entidad) {
    const ent = mapped.entidad.toUpperCase();
    if (ent === 'CITA') mapped.module = 'CITAS';
    else if (ent === 'EMPLEADO') mapped.module = 'USUARIOS';
    else if (ent === 'CLIENTE') mapped.module = 'CLIENTES';
    else if (ent === 'SERVICIO') mapped.module = 'SERVICIOS';
    else if (ent === 'CONFIGURACION') mapped.module = 'CONFIGURACION';
    else mapped.module = ent;
  }

  // Fallback action from accion and entidad
  if (!mapped.action && mapped.accion) {
    const ent = mapped.entidad ? mapped.entidad.toUpperCase() : '';
    const acc = mapped.accion.toUpperCase();
    
    if (ent === 'CITA') {
      if (acc === 'CREAR') mapped.action = 'APPOINTMENT_CREATED';
      else if (acc === 'ACTUALIZAR') mapped.action = 'APPOINTMENT_UPDATED';
      else if (acc === 'ELIMINAR') mapped.action = 'APPOINTMENT_DELETED';
      else if (acc === 'CANCELAR') mapped.action = 'APPOINTMENT_CANCELLED';
      else if (acc === 'REPROGRAMADA') mapped.action = 'APPOINTMENT_RESCHEDULED';
      else mapped.action = `APPOINTMENT_${acc}`;
    } else if (ent === 'EMPLEADO') {
      if (acc === 'CREAR') mapped.action = 'USER_CREATED';
      else if (acc === 'ACTUALIZAR') mapped.action = 'USER_UPDATED';
      else if (acc === 'ELIMINAR') mapped.action = 'USER_DELETED';
      else mapped.action = `USER_${acc}`;
    } else if (ent === 'CLIENTE') {
      if (acc === 'CREAR') mapped.action = 'CLIENT_CREATED';
      else if (acc === 'ACTUALIZAR') mapped.action = 'CLIENT_UPDATED';
      else if (acc === 'ELIMINAR') mapped.action = 'CLIENT_DELETED';
      else mapped.action = `CLIENT_${acc}`;
    } else if (ent === 'SERVICIO') {
      if (acc === 'CREAR') mapped.action = 'SERVICE_CREATED';
      else if (acc === 'ACTUALIZAR') mapped.action = 'SERVICE_UPDATED';
      else if (acc === 'ELIMINAR') mapped.action = 'SERVICE_DELETED';
      else mapped.action = `SERVICE_${acc}`;
    } else if (ent === 'CONFIGURACION') {
      mapped.action = 'SETTINGS_UPDATED';
    } else {
      mapped.action = `${ent}_${acc}`;
    }
  }

  // Fallback description
  if (!mapped.description) {
    const entName = mapped.entidad || 'Entidad';
    const accName = mapped.accion ? mapped.accion.toLowerCase() : 'operación';
    const entId = mapped.entidadId || '';
    
    let label = 'registro';
    if (entName === 'Cita') label = 'cita';
    else if (entName === 'Empleado') label = 'usuario';
    else if (entName === 'Cliente') label = 'cliente';
    else if (entName === 'Servicio') label = 'servicio';
    else if (entName === 'Configuracion') label = 'configuración';

    let desc = '';
    if (accName === 'crear') desc = `Creación de ${label}`;
    else if (accName === 'actualizar') desc = `Actualización de ${label}`;
    else if (accName === 'eliminar') desc = `Eliminación de ${label}`;
    else if (accName === 'cancelar') desc = `Cancelación de ${label}`;
    else desc = `${mapped.accion} de ${label}`;

    if (entId && entId !== 'N/A') {
      desc += ` (ID: ${entId})`;
    }
    mapped.description = desc;
  }

  // Fallback user information from realizadoPor
  if ((!mapped.userName || !mapped.userEmail) && mapped.realizadoPor) {
    const userIdOrVal = mapped.realizadoPor;
    
    if (employeesMap && employeesMap.has(userIdOrVal)) {
      const emp = employeesMap.get(userIdOrVal);
      mapped.userName = emp.nombre;
      mapped.userEmail = emp.correo;
      mapped.userRole = emp.rol;
      mapped.userId = emp.id;
    } else {
      if (userIdOrVal.includes('@')) {
        mapped.userEmail = userIdOrVal;
        mapped.userName = userIdOrVal.split('@')[0];
      } else if (userIdOrVal.match(/^[0-9a-fA-F-]{36}$/)) {
        mapped.userName = `Empleado (ID: ${userIdOrVal.slice(0, 8)})`;
      } else {
        mapped.userName = userIdOrVal;
      }
    }
  }

  return mapped;
}

/**
 * Maps a list of legacy audit logs to the new schema format.
 */
export function mapLegacyAuditLogs(logs: any[], employeesMap?: Map<string, any>): any[] {
  return logs.map(log => mapLegacyAuditLog(log, employeesMap));
}

