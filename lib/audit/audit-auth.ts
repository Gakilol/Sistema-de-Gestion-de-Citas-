import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from './audit-logger';

export const ALLOWED_AUDIT_ROLES = ['ADMIN', 'TECH_SUPPORT'];

export function checkAuditAuth(req: NextRequest): { error: NextResponse } | { userId: string; role: string; email: string } {
  const role = req.headers.get('x-user-role');
  const userId = req.headers.get('x-user-id');
  const email = req.headers.get('x-user-email');

  if (!userId || !role || !ALLOWED_AUDIT_ROLES.includes(role)) {
    // Determine IP and User Agent for safety log
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
