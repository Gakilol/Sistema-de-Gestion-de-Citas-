import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const onlyActive = req.nextUrl.searchParams.get('activo') === 'true';
    const categorias = await prisma.categoria.findMany({
      where: onlyActive ? { activo: true } : undefined,
      orderBy: [
        { orden: 'asc' },
        { nombre: 'asc' }
      ]
    });
    return NextResponse.json({ categorias }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden crear categorías' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, color, orden, activo } = body;

    if (!nombre || nombre.trim() === '') {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    // Verificar si ya existe una categoría con ese nombre
    const existente = await prisma.categoria.findUnique({
      where: { nombre: nombre.trim() }
    });

    if (existente) {
      return NextResponse.json({ error: 'Ya existe una categoría con este nombre' }, { status: 400 });
    }

    const categoria = await prisma.categoria.create({
      data: {
        nombre: nombre.trim(),
        color: color || '#6366f1',
        orden: orden !== undefined ? Number(orden) : 0,
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });

    return NextResponse.json({ categoria, mensaje: 'Categoría creada exitosamente' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
