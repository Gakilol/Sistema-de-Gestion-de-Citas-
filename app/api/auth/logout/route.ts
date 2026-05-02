import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ mensaje: 'Sesión cerrada exitosamente' });

  // Limpiar las cookies
  response.cookies.delete('access_token');
  response.cookies.set('refresh_token', '', { path: '/api/auth/refresh', maxAge: 0 });

  return response;
}
