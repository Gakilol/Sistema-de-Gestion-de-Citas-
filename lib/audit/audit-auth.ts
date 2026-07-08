import { NextRequest, NextResponse } from 'next/server';
import { getUserContext } from '@/lib/auth-helpers';
import { logAudit } from './audit-logger';

export const ALLOWED_AUDIT_ROLES = ['ADMIN', 'TECH_SUPPORT'];

/**
 * Verifica que el usuario tiene permisos para acceder a los logs de auditoría.
 *
 * SEGURIDAD: Usa getUserContext que verifica el JWT criptográficamente.
 * No confía directamente en las cabeceras x-user-* sin verificación.
 */
export function checkAuditAuth(
  req: NextRequest
): { error: NextResponse } | { userId: string; role: string; email: string } {
  // getUserContext verifica el JWT criptográficamente (vía middleware o fallback seguro)
  const { userId, userRole: role, userEmail: email } = getUserContext(req);

  if (!userId || !role || !ALLOWED_AUDIT_ROLES.includes(role)) {
    // Enmascarar IP para el log
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    let ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '');
    if (ip) {
      const parts = ip.split('.');
      if (parts.length === 4) ip = `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    const userAgent = req.headers.get('user-agent') || 'desconocido';

    logAudit({
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      module: 'AUDITORIA',
      status: 'FAILED',
      description: `Intento de acceso no autorizado a la auditoría del sistema (ruta: ${req.nextUrl.pathname})`,
      errorMessage: 'Acceso denegado: Rol o sesión no válidos',
      userId: userId || undefined,
      userRole: role || undefined,
      userEmail: email || undefined,
      ipAddress: ip || undefined,
      userAgent: userAgent || undefined
    });

    return {
      error: NextResponse.json({ error: 'Acceso denegado. Rol no autorizado.' }, { status: 403 })
    };
  }

  return { userId, role, email: email || '' };
}
