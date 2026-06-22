import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

// ─── DELETE /api/backups/[id] (Eliminación lógica e inicio de borrado físico en S3)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Buscar el backup existente
    const backup = await prisma.historialBackup.findUnique({
      where: { id },
    });

    if (!backup || backup.status === 'DELETED') {
      return NextResponse.json({ error: 'El respaldo no existe o ya fue eliminado.' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const reason = searchParams.get('reason') || 'Eliminación manual por usuario';

    // 1. Modificación lógica del Historial
    await prisma.historialBackup.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        deletedById: userId,
        deleteReason: reason,
      },
    });

    // 2. Encolar el trabajo de eliminación física en S3
    const trabajo = await prisma.trabajoBackup.create({
      data: {
        tipo: 'DELETE',
        estado: 'PENDING',
        backupId: id,
        solicitadoPorId: userId,
        solicitadoPorRol: userRole,
        maxIntentos: 3,
        payload: { storageKey: backup.storageKey },
      },
    });

    // 3. Registrar auditoría de eliminación lógica
    await registrarAuditoria({
      entidad: 'BaseDeDatos',
      entidadId: id,
      accion: 'ELIMINAR',
      detalles: { archivo: backup.fileName, motivo: reason, trabajoId: trabajo.id },
      realizadoPor: userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Copia de seguridad marcada para eliminación y encolada para borrado físico de S3.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
