import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

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
    });

    if (!clienteOriginal) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
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
        notas: notas?.trim() || null,
      },
    });

    await registrarAuditoria({
      entidad: 'Cliente',
      entidadId: id,
      accion: 'ACTUALIZAR',
      detalles: {
        antes: { nombre: clienteOriginal.nombre, telefono: clienteOriginal.telefono, correo: clienteOriginal.correo },
        despues: { nombre: clienteActualizado.nombre, telefono: clienteActualizado.telefono, correo: clienteActualizado.correo }
      },
      realizadoPor: userId,
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
    const userRole = req.headers.get('x-user-role');
    
    // Solo administradores pueden eliminar clientes
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden eliminar clientes' }, { status: 403 });
    }

    // 1. Desvincular las citas históricas poniendo cliente_id en null.
    // Esto previene que se rompa la integridad de la base de datos y mantiene
    // el histórico de la cita (nombre y teléfono siguen grabados en la misma fila de Cita).
    await prisma.cita.updateMany({
      where: { cliente_id: id },
      data: { cliente_id: null },
    });

    // 2. Eliminar físicamente al cliente de la base de datos
    await prisma.cliente.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, mensaje: 'Cliente eliminado exitosamente' }, { status: 200 });
  } catch (error: any) {
    console.error('Error al eliminar cliente:', error);
    return NextResponse.json({ error: error.message || 'Error interno al procesar eliminación' }, { status: 400 });
  }
}
