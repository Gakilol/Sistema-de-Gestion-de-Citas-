import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, userRole } = getUserContext(req);
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden editar categorías' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, color, orden, activo } = body;

    const dataToUpdate: any = {};
    if (nombre !== undefined) {
      if (!nombre || nombre.trim() === '') {
        return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
      }
      
      // Verificar si ya existe otra categoría con ese nombre
      const existente = await prisma.categoria.findFirst({
        where: { 
          nombre: nombre.trim(),
          NOT: { id }
        }
      });
      if (existente) {
        return NextResponse.json({ error: 'Ya existe otra categoría con este nombre' }, { status: 400 });
      }
      
      dataToUpdate.nombre = nombre.trim();
    }
    
    if (color !== undefined) dataToUpdate.color = color;
    if (orden !== undefined) dataToUpdate.orden = Number(orden);
    if (activo !== undefined) dataToUpdate.activo = Boolean(activo);

    // Actualizar categoría
    const categoria = await prisma.categoria.update({
      where: { id },
      data: dataToUpdate,
    });

    // Si cambió el nombre, sincronizar el campo de texto legacy 'categoria' en todos los servicios asociados
    if (nombre !== undefined) {
      await prisma.servicio.updateMany({
        where: { categoria_id: id },
        data: { categoria: nombre.trim() }
      });
    }

    return NextResponse.json({ categoria, mensaje: 'Categoría actualizada exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, userRole } = getUserContext(req);
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden eliminar categorías' }, { status: 403 });
    }

    // Verificar si hay servicios asociados a esta categoría
    const serviciosAsociados = await prisma.servicio.count({
      where: { categoria_id: id }
    });

    if (serviciosAsociados > 0) {
      return NextResponse.json({ 
        error: `No se puede eliminar la categoría porque tiene ${serviciosAsociados} servicio(s) asociado(s). Reasigna o elimina los servicios antes de eliminar la categoría.` 
      }, { status: 400 });
    }

    // Eliminar la categoría
    await prisma.categoria.delete({
      where: { id }
    });

    return NextResponse.json({ mensaje: 'Categoría eliminada exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
