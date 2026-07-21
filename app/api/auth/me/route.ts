import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/db';
import { getJwtSecret } from '@/lib/security-secrets';


export async function GET(req: NextRequest) {
  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Configuración de seguridad incorrecta' }, { status: 503 });
    }

    const token = req.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));

    
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
