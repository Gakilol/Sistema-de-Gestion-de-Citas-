import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role');
    
    // Solo administradores pueden eliminar clientes
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden eliminar clientes' }, { status: 403 });
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
