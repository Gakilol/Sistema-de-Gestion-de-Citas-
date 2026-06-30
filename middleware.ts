import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-muy-seguro-para-jwt-saas';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  const path = req.nextUrl.pathname;
  const method = req.method;

  // Rutas y APIs públicas excluidas de protección por token
  const isPublicPath = 
    path === '/login' ||
    path === '/olvide-contrasena' ||
    path === '/restablecer-contrasena' ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/cron') || // Permitir Crons (ej. Vercel Cron) con firma propia
    path.startsWith('/_next') || 
    path.startsWith('/favicon.ico') ||
    path.startsWith('/logo') ||
    path.startsWith('/icon') ||
    path.startsWith('/apple-icon') ||
    path === '/icon.svg';


  if (isPublicPath) {
    // Si hay un token válido e intentan ingresar al /login, los enviamos directo al dashboard
    if (token && path === '/login') {
      try {
        await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
        return NextResponse.redirect(new URL('/dashboard', req.url));
      } catch (e) {
        // Si el token es inválido, dejamos que continúe al login y limpiamos la cookie
        const response = NextResponse.next();
        response.cookies.delete('access_token');
        return response;
      }
    }
    return NextResponse.next();
  }

  // Rutas privadas: Si no hay token
  if (!token) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    const userRole = payload.rol as string;

    // Solo ADMIN, EMPLEADO o TECH_SUPPORT tienen acceso, si no, lo rechazamos
    const allowedRoles = ['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'];
    if (!allowedRoles.includes(userRole)) {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // ─── Protección adicional: /reportes y /api/reportes solo para ADMIN y TECH_SUPPORT
    const reportesRestringidos = ['ADMIN', 'TECH_SUPPORT'];
    const isReportesPath = path.startsWith('/reportes') || path.startsWith('/api/reportes');
    if (isReportesPath && !reportesRestringidos.includes(userRole)) {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acceso denegado. Solo ADMIN y TECH_SUPPORT pueden acceder a los reportes.' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // ─── Protección adicional: /auditoria y /api/auditoria solo para ADMIN y TECH_SUPPORT
    const isAuditoriaPath = path.startsWith('/auditoria') || path.startsWith('/api/auditoria');
    if (isAuditoriaPath && !reportesRestringidos.includes(userRole)) {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acceso denegado. Solo ADMIN y TECH_SUPPORT pueden acceder a la auditoría.' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }


    // Inyectar datos del usuario en los headers para que las rutas de API internas los lean de forma segura
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.id as string);
    requestHeaders.set('x-user-role', userRole);
    requestHeaders.set('x-user-email', payload.email as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    // Token inválido o expirado
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }
    
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('access_token');
    return response;
  }
}

// Configuración de rutas que intercepta Next.js
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
