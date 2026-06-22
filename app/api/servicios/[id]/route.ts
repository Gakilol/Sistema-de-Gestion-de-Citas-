import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');
    const userEmail = req.headers.get('x-user-email');

    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden editar servicios' }, { status: 403 });
    }

    const servicioOriginal = await prisma.servicio.findUnique({
      where: { id }
    });

    if (!servicioOriginal) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
    }

    const body = await req.json();
    const { nombre, descripcion, duracion, categoria, categoria_id, activo } = body;

    const dataToUpdate: any = {};
    if (nombre) dataToUpdate.nombre = nombre;
    if (descripcion !== undefined) dataToUpdate.descripcion = descripcion;
    if (duracion !== undefined) dataToUpdate.duracion = Number(duracion);
    if (activo !== undefined) dataToUpdate.activo = activo;

    if (categoria_id !== undefined) {
      dataToUpdate.categoria_id = categoria_id;
      if (categoria_id) {
        const cat = await prisma.categoria.findUnique({ where: { id: categoria_id } });
        if (cat) {
          dataToUpdate.categoria = cat.nombre;
        }
      } else {
        dataToUpdate.categoria = null;
      }
    } else if (categoria !== undefined) {
      dataToUpdate.categoria = categoria;
    }

    const servicio = await prisma.servicio.update({
      where: { id },
      data: dataToUpdate,
      include: {
        categoriaRel: true
      }
    });

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: 'SERVICE_UPDATED',
      module: 'SERVICIOS',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail,
      entityType: 'Servicio',
      entityId: id,
      entityName: servicio.nombre,
      description: `Servicio ${servicio.nombre} actualizado.`,
      beforeData: servicioOriginal,
      afterData: servicio,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
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
    const userId = req.headers.get('x-user-id');
    const userEmail = req.headers.get('x-user-email');

    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden eliminar servicios' }, { status: 403 });
    }

    const servicio = await prisma.servicio.findUnique({
      where: { id }
    });

    if (!servicio) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
    }

    // 1. Eliminar citas asociadas a este servicio
    await prisma.cita.deleteMany({
      where: { servicio_id: id }
    });

    // 2. Eliminar físicamente el servicio
    await prisma.servicio.delete({
      where: { id }
    });

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: 'SERVICE_DELETED',
      module: 'SERVICIOS',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail,
      entityType: 'Servicio',
      entityId: id,
      entityName: servicio.nombre,
      description: `Servicio ${servicio.nombre} eliminado permanentemente.`,
      beforeData: servicio,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
    });

    return NextResponse.json({ mensaje: 'Servicio eliminado exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
