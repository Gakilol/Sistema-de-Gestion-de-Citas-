import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { serializarBackup } from '../../backups/route';

// ─── GET /api/cron/backups (Planificador de copias automáticas y retención)
export async function GET(req: NextRequest) {
  try {
    // 1. Validar Token de seguridad del Cron
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'fallback-cron-secret-1234';
    const url = new URL(req.url);
    const querySecret = url.searchParams.get('secret');

    if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 2. Obtener la configuración general de backups
    const configRecord = await prisma.configuracion.findUnique({
      where: { id: 'default' },
    });

    const backupsConfig: any = configRecord?.backups || {};
    const diarioEnabled = backupsConfig.diario?.enabled ?? true; // Habilitado por defecto

    let backupEncolado = null;
    let trabajoId = null;

    if (diarioEnabled) {
      // Validar si ya se hizo un backup automático en las últimas 23 horas para evitar duplicados
      const hace23Horas = new Date(Date.now() - 23 * 60 * 60 * 1000);
      const backupReciente = await prisma.historialBackup.findFirst({
        where: {
          type: 'AUTOMATIC',
          createdAt: {
            gte: hace23Horas,
          },
          status: {
            not: 'FAILED',
          },
        },
      });

      if (!backupReciente) {
        // Generar nombre de archivo único
        const ahora = new Date();
        const pad = (num: number) => num.toString().padStart(2, '0');
        const yyyy = ahora.getFullYear();
        const mm = pad(ahora.getMonth() + 1);
        const dd = pad(ahora.getDate());
        const hh = pad(ahora.getHours());
        const min = pad(ahora.getMinutes());
        const ss = pad(ahora.getSeconds());
        
        const fileName = `backup-sistema-citas-AUTO-${yyyy}-${mm}-${dd}-${hh}-${min}-${ss}.backup`;

        // Crear HistorialBackup
        const historial = await prisma.historialBackup.create({
          data: {
            fileName,
            storageProvider: process.env.BACKUP_STORAGE_PROVIDER || 's3',
            storageBucket: process.env.S3_BUCKET || '',
            storageKey: `backups/${fileName}`,
            sizeBytes: 0n,
            checksumSha256: '',
            status: 'PENDING',
            type: 'AUTOMATIC',
            createdById: 'SYSTEM_CRON',
            createdByRole: 'SYSTEM',
          },
        });

        // Encolar Trabajo
        const maxRetries = parseInt(process.env.BACKUP_MAX_RETRIES || '3', 10);
        const trabajo = await prisma.trabajoBackup.create({
          data: {
            tipo: 'BACKUP',
            estado: 'PENDING',
            backupId: historial.id,
            solicitadoPorId: 'SYSTEM_CRON',
            solicitadoPorRol: 'SYSTEM',
            maxIntentos: maxRetries,
            payload: {},
          },
        });

        backupEncolado = historial;
        trabajoId = trabajo.id;

        await registrarAuditoria({
          entidad: 'BaseDeDatos',
          entidadId: historial.id,
          accion: 'CREAR',
          detalles: { tipo: 'AUTOMATICO', archivo: fileName, trabajoId: trabajo.id },
          realizadoPor: 'SYSTEM_CRON',
        });
      }
    }

    // 3. Ejecutar Políticas de Retención
    const limpiezaStats = await ejecutarPoliticasDeRetencion(backupsConfig);

    return NextResponse.json({
      success: true,
      backupEncolado: serializarBackup(backupEncolado),
      trabajoId,
      limpieza: limpiezaStats,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Lógica de limpieza según retención
async function ejecutarPoliticasDeRetencion(config: any) {
  const retencion = config.retencion || {
    manual: 10,
    automatico: 15,
    preRestore: 5,
  };

  const limitManual = retencion.manual || 10;
  const limitAutomatic = retencion.automatico || 15;
  const limitPreRestore = retencion.preRestore || 5;

  const logsEliminados: string[] = [];

  // Función interna para depurar un tipo de backup
  const depurarTipo = async (type: string, limite: number) => {
    // Obtener backups activos del tipo especificado ordenados de más reciente a más antiguo
    const backups = await prisma.historialBackup.findMany({
      where: {
        type,
        status: {
          not: 'DELETED',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (backups.length <= limite) return;

    // Los elementos a eliminar son aquellos posteriores al límite
    const candidatos = backups.slice(limite);
    const ahora = new Date();
    const hace24Horas = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

    for (const backup of candidatos) {
      // REGLA 1: Nunca borrar el backup más reciente exitoso
      const esUltimoExitoso = backups.find(b => b.status === 'COMPLETED')?.id === backup.id;
      if (esUltimoExitoso) continue;

      // REGLA 2: Nunca borrar backups creados hace menos de 24 horas
      if (backup.createdAt > hace24Horas) continue;

      // Borrado lógico y encolado de borrado físico
      await prisma.historialBackup.update({
        where: { id: backup.id },
        data: {
          status: 'DELETED',
          deletedAt: ahora,
          deletedById: 'SYSTEM_CRON',
          deleteReason: 'Limpieza automática por política de retención.',
        },
      });

      await prisma.trabajoBackup.create({
        data: {
          tipo: 'DELETE',
          estado: 'PENDING',
          backupId: backup.id,
          solicitadoPorId: 'SYSTEM_CRON',
          solicitadoPorRol: 'SYSTEM',
          maxIntentos: 3,
          payload: { storageKey: backup.storageKey },
        },
      });

      logsEliminados.push(backup.fileName);

      await registrarAuditoria({
        entidad: 'BaseDeDatos',
        entidadId: backup.id,
        accion: 'ELIMINAR',
        detalles: { archivo: backup.fileName, motivo: 'Política de retención excedida.' },
        realizadoPor: 'SYSTEM_CRON',
      });
    }
  };

  await depurarTipo('MANUAL', limitManual);
  await depurarTipo('AUTOMATIC', limitAutomatic);
  await depurarTipo('PRE_RESTORE', limitPreRestore);

  return {
    eliminados: logsEliminados.length,
    archivos: logsEliminados,
  };
}
