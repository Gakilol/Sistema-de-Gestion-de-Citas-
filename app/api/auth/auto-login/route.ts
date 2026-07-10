import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signToken, signRefreshToken } from '@/lib/jwt';
import { hashRememberToken, generateRememberToken, parseUserAgent } from '@/lib/remember-device';
import { logAudit, getClientIp } from '@/lib/audit/audit-logger';

export async function POST(req: NextRequest) {
  const ipAddress = getClientIp(req.headers);
  const userAgent = req.headers.get('user-agent') || 'desconocido';
  const token = req.cookies.get('remember_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Token de dispositivo no encontrado' }, { status: 401 });
  }

  try {
    const tokenHash = hashRememberToken(token);

    // Buscar el dispositivo recordado activo en la base de datos
    const deviceRecord = await prisma.dispositivoRecordado.findUnique({
      where: { tokenHash },
      include: { empleado: true },
    });

    // Validaciones de seguridad requeridas
    if (!deviceRecord) {
      return handleInvalidToken(token, ipAddress, userAgent, 'Dispositivo no encontrado en base de datos');
    }

    if (deviceRecord.revokedAt !== null) {
      return handleInvalidToken(token, ipAddress, userAgent, 'El acceso de este dispositivo ha sido revocado');
    }

    if (deviceRecord.expiresAt < new Date()) {
      return handleInvalidToken(token, ipAddress, userAgent, 'El token de dispositivo ha expirado');
    }

    const empleado = deviceRecord.empleado;
    if (!empleado || !empleado.activo) {
      return handleInvalidToken(token, ipAddress, userAgent, 'La cuenta de usuario no existe o está inactiva');
    }

    const allowedRoles = ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'];
    if (!allowedRoles.includes(empleado.rol)) {
      return handleInvalidToken(token, ipAddress, userAgent, 'Rol de usuario no válido');
    }

    // ─── Generar sesión normal (JWT) ─────────────────────────
    const tokenPayload = {
      id: empleado.id,
      email: empleado.correo,
      rol: empleado.rol,
    };

    const accessToken = await signToken(tokenPayload);
    const refreshToken = await signRefreshToken({ id: empleado.id });

    // ─── Rotar el token persistente ──────────────────────────
    const newToken = generateRememberToken();
    const newTokenHash = hashRememberToken(newToken);
    const newExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 días desde hoy

    // Actualizar registro con el nuevo hash y la fecha de último uso
    await prisma.dispositivoRecordado.update({
      where: { id: deviceRecord.id },
      data: {
        tokenHash: newTokenHash,
        lastUsedAt: new Date(),
        expiresAt: newExpiresAt,
        ipAddress,
        userAgent,
        deviceName: parseUserAgent(userAgent),
      },
    });

    const response = NextResponse.json({
      mensaje: 'Autenticación automática exitosa',
      usuario: {
        id: empleado.id,
        nombre: empleado.nombre,
        email: empleado.correo,
        rol: empleado.rol,
      },
    });

    // Enviar cookies seguras actualizadas
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 horas
      path: '/',
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/api/auth/refresh',
    });

    response.cookies.set('remember_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 24 * 60 * 60, // 60 días
      path: '/',
    });

    // Registrar en auditoría el auto-login exitoso
    await logAudit({
      action: 'AUTO_LOGIN_SUCCESS',
      module: 'AUTH',
      status: 'SUCCESS',
      userId: empleado.id,
      userName: empleado.nombre,
      userEmail: empleado.correo,
      userRole: empleado.rol,
      description: `Autologin exitoso para ${empleado.correo} en dispositivo ${deviceRecord.deviceName || 'desconocido'}`,
      ipAddress,
      userAgent,
      metadata: { dispositivoId: deviceRecord.id },
    });

    return response;
  } catch (error: any) {
    console.error('[AUTO_LOGIN_ERROR]', error);
    return NextResponse.json({ error: 'Error interno del servidor durante el inicio automático' }, { status: 500 });
  }
}

/**
 * Limpia la cookie inválida y registra el fallo si es oportuno.
 */
async function handleInvalidToken(
  token: string,
  ipAddress: string,
  userAgent: string,
  reason: string
) {
  const response = NextResponse.json({ error: reason }, { status: 401 });
  
  // Limpiar cookies
  response.cookies.set('remember_token', '', { path: '/', maxAge: 0 });
  response.cookies.set('access_token', '', { path: '/', maxAge: 0 });
  response.cookies.set('refresh_token', '', { path: '/api/auth/refresh', maxAge: 0 });

  // Registrar auditoría de fallo de auto-login
  await logAudit({
    action: 'AUTO_LOGIN_FAILED',
    module: 'AUTH',
    status: 'FAILED',
    description: `Intento de autologin fallido. Motivo: ${reason}`,
    ipAddress,
    userAgent,
    metadata: { reason },
  });

  return response;
}
