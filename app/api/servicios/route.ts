import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../src/lib/db';

export async function GET(req: NextRequest) {
  try {
    const busqueda = req.nextUrl.searchParams.get('q') || '';
    const servicios = await prisma.servicio.findMany({
      where: {
        OR: busqueda ? [
          { nombre: { contains: busqueda, mode: 'insensitive' } },
          { descripcion: { contains: busqueda, mode: 'insensitive' } },
          { categoria: { contains: busqueda, mode: 'insensitive' } },
        ] : undefined,
      },
      orderBy: { nombre: 'asc' },
    });
    return NextResponse.json({ servicios }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden crear servicios' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, descripcion, duracion, precio, categoria } = body;

    const servicio = await prisma.servicio.create({
      data: {
        nombre,
        descripcion,
        duracion: Number(duracion),
        precio: Number(precio),
        categoria,
      },
    });

    return NextResponse.json({ servicio, mensaje: 'Servicio creado exitosamente' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
