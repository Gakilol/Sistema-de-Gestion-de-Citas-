import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthServicio } from '@/src/servicios/auth.servicio';
import { logAudit, getClientIp } from '@/lib/audit/audit-logger';
import { checkLoginRateLimit } from '@/lib/audit/rate-limiter';

// ─── Schema de validación Zod ────────────────────────────────────────────────
const LoginInputSchema = z.object({
  email: z.string().email('Correo electrónico no válido').max(254),
  password: z.string().min(1, 'La contraseña es obligatoria').max(128),
});

export async function POST(req: NextRequest) {
  let body: any = {};
  const ipAddress = getClientIp(req.headers);
  const userAgent = req.headers.get('user-agent') || 'desconocido';

  try {
    // 1. Parsear body con manejo de errores
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
    }

    // 2. Extraer correo para el rate limit (antes de validar Zod, para bloquearlo aunque el email sea inválido)
    const attemptedEmail = (body.correo || body.email || '').toString().trim().toLowerCase().slice(0, 254);

    // 3. Verificar rate limit ANTES de procesar el login
    const rateLimitCheck = await checkLoginRateLimit(ipAddress, attemptedEmail, userAgent);
    if (rateLimitCheck.blocked) {
      // Registrar el intento bloqueado en auditoría
      await logAudit({
        action: 'LOGIN_BLOCKED_RATE_LIMIT',
        module: 'AUTH',
        status: 'FAILED',
        description: 'Intento de login bloqueado por rate limit',
        ipAddress,
        userAgent,
        metadata: {
          email: attemptedEmail,
          blockedUntil: rateLimitCheck.blockedUntil?.toISOString(),
        },
      });

      return NextResponse.json(
        { error: 'Demasiados intentos fallidos. Por seguridad, el acceso ha sido bloqueado temporalmente. Intente nuevamente más tarde.' },
        {
          status: 429,
          headers: { 'Retry-After': '900' },
        }
      );
    }

    // 4. Validar inputs con Zod
    const parseResult = LoginInputSchema.safeParse({
      email: body.correo || body.email,
      password: body.password,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' }, // Mensaje genérico por seguridad
        { status: 401 }
      );
    }

    // 5. Intentar autenticación
    const result = await AuthServicio.login({
      email: parseResult.data.email,
      password: parseResult.data.password,
    });

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
      metadata: { email: result.usuario.email },
    });

    return response;
  } catch (error: any) {
    // Log LOGIN_FAILED (la contraseña fue incorrecta o el usuario no existe)
    const attemptedEmail = body.correo || body.email || 'desconocido';
    await logAudit({
      action: 'LOGIN_FAILED',
      module: 'AUTH',
      status: 'FAILED',
      description: `Intento de inicio de sesión fallido para ${attemptedEmail}`,
      errorMessage: 'Credenciales inválidas', // No exponer el motivo real
      ipAddress,
      userAgent,
      userEmail: typeof attemptedEmail === 'string' ? attemptedEmail : undefined,
      metadata: { email: attemptedEmail },
    });

    // Mensaje genérico: no revelar si el correo existe o no
    return NextResponse.json(
      { error: 'Credenciales inválidas' },
      { status: 401 }
    );
  }
}
