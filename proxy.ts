import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-muy-seguro-para-jwt-saas';

export async function proxy(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  const path = req.nextUrl.pathname;

  // Rutas públicas que no necesitan autenticación
  if (
    path.startsWith('/api/auth') || 
    path === '/login' ||
    path.startsWith('/_next') || 
    path.startsWith('/favicon.ico') ||
    path.startsWith('/logo')
  ) {
    return NextResponse.next();
  }

  if (!token) {
    // Si es una ruta de API
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    
    // Redirigir al login
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Si hay token y visita página de login, redirigir al dashboard
  if (token && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    const userRole = payload.rol as string;

    // Solo ADMIN o EMPLEADO tienen acceso, si no, lo rechazamos
    if (userRole !== 'ADMIN' && userRole !== 'EMPLEADO') {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Inyectar datos del usuario en los headers para que las rutas de API los lean
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
    // Si el token expiró o es inválido, forzar logout visual
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }
    
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('access_token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
