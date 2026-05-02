import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-muy-seguro-para-jwt-saas';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  const path = req.nextUrl.pathname;

  // Rutas públicas que no necesitan middleware
  if (
    path.startsWith('/api/auth') || 
    path === '/' || 
    path.startsWith('/_next') || 
    path.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  if (!token) {
    // Si es una ruta de API
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    // Redirigir al login si no tiene token y visita una ruta del portal
    if (path.startsWith('/cliente')) {
      return NextResponse.redirect(new URL('/cliente/login', req.url));
    }
    if (path.startsWith('/personal')) {
      return NextResponse.redirect(new URL('/personal/login', req.url));
    }
    return NextResponse.next();
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    const userRole = payload.rol as string;

    // Protección de rutas por roles (RBAC)
    if (path.startsWith('/api/admin') && userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado (Requiere Admin)' }, { status: 403 });
    }

    if (path.startsWith('/api/empleado') && userRole !== 'EMPLEADO' && userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado (Requiere Empleado)' }, { status: 403 });
    }

    if (path.startsWith('/api/cliente') && userRole !== 'CLIENTE' && userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado (Requiere Cliente)' }, { status: 403 });
    }

    // Opcional: Inyectar datos del usuario en los headers para que las rutas de API los lean
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
    
    // Podríamos intentar renovarlo llamando al refresh token si estuviéramos en el cliente,
    // pero desde el middleware es mejor redirigir al login.
    const response = NextResponse.redirect(new URL('/', req.url));
    response.cookies.delete('access_token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
