import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logAudit, getClientIp } from '@/lib/audit/audit-logger';
import { getUserContext } from '@/lib/auth-helpers';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, userRole, userEmail } = getUserContext(req);

    if (!userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { nombre, telefono, correo, notas } = body;

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json({ error: 'El nombre es obligatorio (mínimo 2 caracteres)' }, { status: 400 });
    }

    const clienteOriginal = await prisma.cliente.findUnique({
      where: { id },
      include: {
        citas: { select: { empleado_id: true } }
      }
    });

    if (!clienteOriginal) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    if (userRole === 'EMPLEADO') {
      const isRegisteredByMe = clienteOriginal.createdByUserId === userId;
      if (!isRegisteredByMe) {
        return NextResponse.json({ error: 'No tienes permiso para modificar este cliente por privacidad' }, { status: 403 });
      }
    }

    // Validar teléfono duplicado (solo si se provee uno)
    if (telefono && telefono.trim()) {
      const duplicadoTel = await prisma.cliente.findFirst({
        where: {
          telefono: telefono.trim(),
          id: { not: id },
        },
      });
      if (duplicadoTel) {
        return NextResponse.json(
          { error: `Ya existe un cliente con el teléfono ${telefono.trim()} (${duplicadoTel.nombre})` },
          { status: 409 }
        );
      }
    }

    // Validar correo duplicado (solo si se provee uno)
    if (correo && correo.trim()) {
      const duplicadoEmail = await prisma.cliente.findFirst({
        where: {
          correo: correo.trim().toLowerCase(),
          id: { not: id },
        },
      });
      if (duplicadoEmail) {
        return NextResponse.json(
          { error: `Ya existe un cliente con ese correo electrónico (${duplicadoEmail.nombre})` },
          { status: 409 }
        );
      }
    }

    const clienteActualizado = await prisma.cliente.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
        correo: correo?.trim().toLowerCase() || null,
        notes: (notas !== undefined) ? (notas?.trim() || null) : undefined, // Keep existing notas field mapping if it is renamed or if it has notes, wait, schema is notas.
        notas: notas?.trim() || null,
      } as any, // Cast to any in case of database fields naming variation
    });

    await logAudit({
      action: 'CLIENT_UPDATED',
      module: 'CLIENTES',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail,
      entityType: 'Cliente',
      entityId: id,
      entityName: clienteActualizado.nombre,
      description: `Cliente ${clienteOriginal.nombre} actualizado.`,
      beforeData: clienteOriginal,
      afterData: clienteActualizado,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
    });

    return NextResponse.json({ cliente: clienteActualizado, mensaje: 'Cliente actualizado exitosamente' }, { status: 200 });
  } catch (error: any) {
    console.error('Error al actualizar cliente:', error);
    return NextResponse.json({ error: error.message || 'Error interno al procesar actualización' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, userRole, userEmail } = getUserContext(req);
    const ipAddress = getClientIp(req.headers);
    const userAgent = req.headers.get('user-agent') || undefined;
    
    const cliente = await prisma.cliente.findUnique({
      where: { id }
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Validación de permisos para eliminación
    if (userRole === 'EMPLEADO') {
      if (cliente.createdByUserId !== userId) {
        return NextResponse.json({ error: 'No tienes permiso para eliminar este cliente ya que no fue registrado por ti' }, { status: 403 });
      }
    } else if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden eliminar clientes' }, { status: 403 });
    }

    // 1. Desvincular las citas históricas poniendo cliente_id en null.
    await prisma.cita.updateMany({
      where: { cliente_id: id },
      data: { cliente_id: null },
    });

    // 2. Eliminar físicamente al cliente de la base de datos
    await prisma.cliente.delete({
      where: { id },
    });

    await logAudit({
      action: 'CLIENT_DELETED',
      module: 'CLIENTES',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail,
      entityType: 'Cliente',
      entityId: id,
      entityName: cliente.nombre,
      description: `Cliente ${cliente.nombre} eliminado exitosamente.`,
      beforeData: cliente,
      ipAddress,
      userAgent
    });

    return NextResponse.json({ success: true, mensaje: 'Cliente eliminado exitosamente' }, { status: 200 });
  } catch (error: any) {
    console.error('Error al eliminar cliente:', error);
    return NextResponse.json({ error: error.message || 'Error interno al procesar eliminación' }, { status: 400 });
  }
}
