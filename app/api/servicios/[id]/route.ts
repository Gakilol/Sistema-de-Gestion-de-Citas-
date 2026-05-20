import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden editar servicios' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, descripcion, duracion, categoria, activo } = body;

    const dataToUpdate: any = {};
    if (nombre) dataToUpdate.nombre = nombre;
    if (descripcion !== undefined) dataToUpdate.descripcion = descripcion;
    if (duracion !== undefined) dataToUpdate.duracion = Number(duracion);
    if (categoria !== undefined) dataToUpdate.categoria = categoria;
    if (activo !== undefined) dataToUpdate.activo = activo;

    const servicio = await prisma.servicio.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ servicio, mensaje: 'Servicio actualizado' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden eliminar servicios' }, { status: 403 });
    }

    // 1. Eliminar citas asociadas a este servicio
    await prisma.cita.deleteMany({
      where: { servicio_id: id }
    });

    // 2. Eliminar físicamente el servicio
    await prisma.servicio.delete({
      where: { id }
    });

    return NextResponse.json({ mensaje: 'Servicio eliminado exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
