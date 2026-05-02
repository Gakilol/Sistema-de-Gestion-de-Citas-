import { NextResponse } from 'next/server';
import { AuthServicio } from '../../../../src/servicios/auth.servicio';

export async function POST(req: Request) {
  try {
    const body = await req.json();
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

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Credenciales inválidas' },
      { status: 401 }
    );
  }
}
