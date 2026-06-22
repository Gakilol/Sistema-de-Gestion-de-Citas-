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
