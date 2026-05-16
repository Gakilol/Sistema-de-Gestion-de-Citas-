import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '../../../../src/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-muy-seguro-para-jwt-saas';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    
    const empleado = await prisma.empleado.findUnique({
      where: { id: payload.id as string },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        rol: true,
        activo: true,
        especialidad: true,
      }
    });

    if (!empleado || !empleado.activo) {
      return NextResponse.json({ error: 'Usuario no encontrado o inactivo' }, { status: 404 });
    }

    return NextResponse.json({ 
      usuario: {
        id: empleado.id,
        nombre: empleado.nombre,
        email: empleado.correo,
        telefono: empleado.telefono,
        rol: empleado.rol,
        especialidad: empleado.especialidad,
      }
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }
}
