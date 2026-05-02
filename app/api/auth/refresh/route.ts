import { NextResponse, NextRequest } from 'next/server';
import { verifyRefreshToken, signToken } from '../../../../src/auth/jwt';
import { prisma } from '../../../../src/lib/db';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token requerido' }, { status: 401 });
    }

    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
      return NextResponse.json({ error: 'Refresh token inválido' }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: payload.id } });

    if (!usuario || !usuario.activo) {
      return NextResponse.json({ error: 'Usuario no encontrado o inactivo' }, { status: 401 });
    }

    const newAccessToken = await signToken({
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    });

    const response = NextResponse.json({ mensaje: 'Token renovado' });

    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60, // 1 hora
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Error al renovar token' }, { status: 500 });
  }
}
