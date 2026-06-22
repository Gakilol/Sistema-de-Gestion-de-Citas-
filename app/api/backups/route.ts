import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

// Helper para convertir BigInt a string en respuestas JSON
export function serializarBackup(backup: any) {
  if (!backup) return null;
  return {
    ...backup,
    sizeBytes: backup.sizeBytes ? backup.sizeBytes.toString() : null,
  };
}

// ─── GET /api/backups (Listar historial de backups activos)
export async function GET(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const backups = await prisma.historialBackup.findMany({
      where: {
        status: {
          not: 'DELETED',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const serializados = backups.map(serializarBackup);
    return NextResponse.json({ backups: serializados });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST /api/backups (Encolar backup manual)
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Generar nombre de archivo único: backup-sistema-citas-YYYY-MM-DD-HH-mm.backup
    const ahora = new Date();
    const pad = (num: number) => num.toString().padStart(2, '0');
    const yyyy = ahora.getFullYear();
    const mm = pad(ahora.getMonth() + 1);
    const dd = pad(ahora.getDate());
    const hh = pad(ahora.getHours());
    const min = pad(ahora.getMinutes());
    const ss = pad(ahora.getSeconds());
    
    const fileName = `backup-sistema-citas-${yyyy}-${mm}-${dd}-${hh}-${min}-${ss}.backup`;

    // 1. Crear registro en HistorialBackup
    const historial = await prisma.historialBackup.create({
      data: {
        fileName,
        storageProvider: process.env.BACKUP_STORAGE_PROVIDER || 's3',
        storageBucket: process.env.S3_BUCKET || '',
        storageKey: `backups/${fileName}`,
        sizeBytes: 0n,
        checksumSha256: '',
        status: 'PENDING',
        type: 'MANUAL',
        createdById: userId,
        createdByRole: userRole,
      },
    });

    // 2. Crear trabajo en la cola TrabajoBackup
    const maxRetries = parseInt(process.env.BACKUP_MAX_RETRIES || '3', 10);
    const trabajo = await prisma.trabajoBackup.create({
      data: {
        tipo: 'BACKUP',
        estado: 'PENDING',
        backupId: historial.id,
        solicitadoPorId: userId,
        solicitadoPorRol: userRole,
        maxIntentos: maxRetries,
        payload: {},
      },
    });

    // 3. Registrar en Auditoría
    await registrarAuditoria({
      entidad: 'BaseDeDatos',
      entidadId: historial.id,
      accion: 'CREAR',
      detalles: { tipo: 'MANUAL', archivo: fileName, trabajoId: trabajo.id },
      realizadoPor: userId,
    });

    return NextResponse.json({
      message: 'Trabajo de copia de seguridad encolado correctamente.',
      backup: serializarBackup(historial),
      jobId: trabajo.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
