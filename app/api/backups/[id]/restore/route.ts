import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { serializarBackup } from '../../route';

// ─── POST /api/backups/[id]/restore (Iniciar flujo de restauración)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

    // 1. Validar Rol (Solo TECH_SUPPORT)
    if (userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({
        error: 'Operación no permitida. Solo Soporte Técnico puede realizar restauraciones de base de datos.'
      }, { status: 403 });
    }

    // 2. Validar que la restauración esté activada en producción
    const restoreEnabled = process.env.BACKUP_RESTORE_ENABLED === 'true';
    if (!restoreEnabled) {
      return NextResponse.json({
        error: 'La restauración está deshabilitada en producción. Active BACKUP_RESTORE_ENABLED=true en el entorno.'
      }, { status: 400 });
    }

    // 3. Validar cuerpo y confirmaciones
    const body = await req.json();
    const { confirmation, fileName, understandDataLoss } = body;

    if (confirmation !== 'RESTAURAR') {
      return NextResponse.json({ error: 'Debe escribir exactamente "RESTAURAR" para confirmar.' }, { status: 400 });
    }

    if (!understandDataLoss) {
      return NextResponse.json({ error: 'Debe aceptar y confirmar que entiende que se reemplazarán los datos.' }, { status: 400 });
    }

    // 4. Buscar backup destino
    const backup = await prisma.historialBackup.findUnique({
      where: { id },
    });

    if (!backup || backup.status === 'DELETED') {
      return NextResponse.json({ error: 'El respaldo no existe o fue eliminado.' }, { status: 404 });
    }

    if (backup.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Solo se pueden restaurar respaldos en estado COMPLETADO.' }, { status: 400 });
    }

    if (backup.fileName !== fileName) {
      return NextResponse.json({ error: 'El nombre del archivo ingresado no coincide con el archivo de respaldo.' }, { status: 400 });
    }

    // 5. Generar nombre para el backup automático previo (AUTO-PRE-RESTORE)
    const ahora = new Date();
    const pad = (num: number) => num.toString().padStart(2, '0');
    const yyyy = ahora.getFullYear();
    const mm = pad(ahora.getMonth() + 1);
    const dd = pad(ahora.getDate());
    const hh = pad(ahora.getHours());
    const min = pad(ahora.getMinutes());
    const ss = pad(ahora.getSeconds());
    
    const preRestoreFileName = `backup-sistema-citas-AUTO-PRE-RESTORE-${yyyy}-${mm}-${dd}-${hh}-${min}-${ss}.backup`;

    // 6. Crear registro del backup previo en HistorialBackup
    const autoBackup = await prisma.historialBackup.create({
      data: {
        fileName: preRestoreFileName,
        storageProvider: backup.storageProvider,
        storageBucket: backup.storageBucket,
        storageKey: `backups/${preRestoreFileName}`,
        sizeBytes: 0n,
        checksumSha256: '',
        status: 'PENDING',
        type: 'PRE_RESTORE',
        createdById: userId,
        createdByRole: userRole,
      },
    });

    // 7. Crear el Trabajo de BACKUP_PRE_RESTORE
    // El payload contiene toda la metadata necesaria para encolar la restauración real una vez que este backup finalice exitosamente.
    const preRestoreJob = await prisma.trabajoBackup.create({
      data: {
        tipo: 'BACKUP_PRE_RESTORE',
        estado: 'PENDING',
        backupId: autoBackup.id,
        solicitadoPorId: userId,
        solicitadoPorRol: userRole,
        maxIntentos: 3,
        payload: {
          restoreBackupId: id,
          requestedById: userId,
          requestedByRole: userRole,
          requestedAt: ahora.toISOString(),
          confirmationVerified: true,
          targetEnvironment: process.env.NODE_ENV || 'production',
          maintenanceMessage: 'Restauración del sistema en curso.',
        },
      },
    });

    // 8. Registrar auditoría de inicio de cadena de restauración
    await registrarAuditoria({
      entidad: 'BaseDeDatos',
      entidadId: id,
      accion: 'FORZAR',
      detalles: {
        accion: 'INICIO_CADENA_RESTAURACION',
        archivoDestino: backup.fileName,
        archivoAutoPrevio: preRestoreFileName,
        trabajoPreRestoreId: preRestoreJob.id
      },
      realizadoPor: userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Se ha encolado la creación del respaldo automático previo de seguridad. La restauración procederá automáticamente al finalizar.',
      autoBackup: serializarBackup(autoBackup),
      jobId: preRestoreJob.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
