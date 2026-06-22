import { NextRequest, NextResponse } from 'next/server';
import { AuthServicio } from '@/src/servicios/auth.servicio';
import { logAudit, getClientIp } from '@/lib/audit/audit-logger';

export async function POST(req: NextRequest) {
  let body: any = {};
  const ipAddress = getClientIp(req.headers);
  const userAgent = req.headers.get('user-agent') || 'desconocido';

  try {
    body = await req.json();
    const result = await AuthServicio.login(body);

    const response = NextResponse.json(
      { mensaje: 'Login exitoso', usuario: result.usuario },
      { status: 200 }
    );

    // Configurar cookies httpOnly seguras
    response.cookies.set('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60, // 1 hora
      path: '/',
    });

    response.cookies.set('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/api/auth/refresh',
    });

    // Log LOGIN_SUCCESS
    await logAudit({
      action: 'LOGIN_SUCCESS',
      module: 'AUTH',
      status: 'SUCCESS',
      userId: result.usuario.id,
      userName: result.usuario.nombre,
      userEmail: result.usuario.email,
      userRole: result.usuario.rol,
      description: `Inicio de sesión exitoso para ${result.usuario.email}`,
      ipAddress,
      userAgent,
      metadata: { email: result.usuario.email }
    });

    return response;
  } catch (error: any) {
    // Log LOGIN_FAILED
    const attemptedEmail = body.correo || body.email || 'desconocido';
    await logAudit({
      action: 'LOGIN_FAILED',
      module: 'AUTH',
      status: 'FAILED',
      description: `Intento de inicio de sesión fallido para ${attemptedEmail}`,
      errorMessage: error.message || 'Credenciales inválidas',
      ipAddress,
      userAgent,
      metadata: { email: attemptedEmail }
    });

    return NextResponse.json(
      { error: error.message || 'Credenciales inválidas' },
      { status: 401 }
    );
  }
}
