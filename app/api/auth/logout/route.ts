import { NextRequest, NextResponse } from 'next/server';
import { logAudit, getClientIp } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { hashRememberToken } from '@/lib/remember-device';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ mensaje: 'Sesión cerrada exitosamente' });

  // Get user details injected by middleware
  const userId = req.headers.get('x-user-id');
  const userRole = req.headers.get('x-user-role');
  const userEmail = req.headers.get('x-user-email');
  const ipAddress = getClientIp(req.headers);
  const userAgent = req.headers.get('user-agent') || 'desconocido';

  // Buscar y revocar token persistente del dispositivo actual si existe
  const rememberToken = req.cookies.get('remember_token')?.value;
  if (rememberToken) {
    try {
      const tokenHash = hashRememberToken(rememberToken);
      await prisma.dispositivoRecordado.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (dbError) {
      console.error('[LOGOUT_DB_ERROR] Error al revocar dispositivo recordado:', dbError);
    }
  }

  if (userId && userEmail) {
    await logAudit({
      action: 'LOGOUT',
      module: 'AUTH',
      status: 'SUCCESS',
      userId,
      userRole,
      userEmail,
      description: `Cierre de sesión exitoso para ${userEmail}`,
      ipAddress,
      userAgent
    });
  }

  // Limpiar las cookies
  response.cookies.delete('access_token');
  response.cookies.set('refresh_token', '', { path: '/api/auth/refresh', maxAge: 0 });
  response.cookies.set('remember_token', '', { path: '/', maxAge: 0 });

  return response;
}
