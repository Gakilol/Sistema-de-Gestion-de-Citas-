import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { validarPeticion } from '@/lib/backup-hmac';

// ─── POST /api/backups/webhook (Notificaciones desde el Worker)
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    
    // Obtener headers de validación
    const auth = req.headers.get('authorization');
    const timestamp = req.headers.get('x-backup-timestamp');
    const nonce = req.headers.get('x-backup-nonce');
    const signature = req.headers.get('x-backup-signature');

    // Validar firma HMAC
    const validacion = validarPeticion(auth, timestamp, nonce, signature, rawBody);
    if (!validacion.valido) {
      return NextResponse.json({ error: validacion.error || 'Acceso Denegado' }, { status: 403 });
    }

    const payload = JSON.parse(rawBody);
    const { trabajoId, tipo, estado, backupId, error } = payload;

    if (!trabajoId || !tipo || !estado) {
      return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 });
    }

    console.log(`[Webhook] Recibida actualización de trabajo: ${trabajoId} (${tipo}) -> ${estado}`);

    // Registrar en auditoría de acuerdo a la operación terminada
    if (estado === 'COMPLETED') {
      let logMsg = `Trabajo de tipo ${tipo} completado con éxito.`;
      if (tipo === 'RESTORE') {
        logMsg = `Restauración de base de datos finalizada exitosamente para backup ${backupId}.`;
      } else if (tipo === 'BACKUP' || tipo === 'BACKUP_PRE_RESTORE') {
        logMsg = `Copia de seguridad finalizada exitosamente para backup ${backupId}.`;
      }

      await registrarAuditoria({
        entidad: 'BaseDeDatos',
        entidadId: backupId || 'sistema',
        accion: tipo === 'RESTORE' ? 'FORZAR' : 'ACTUALIZAR',
        detalles: { mensaje: logMsg, trabajoId },
        realizadoPor: 'SYSTEM_WORKER',
      });
    } else if (estado === 'FAILED') {
      await registrarAuditoria({
        entidad: 'BaseDeDatos',
        entidadId: backupId || 'sistema',
        accion: 'ACTUALIZAR',
        detalles: { error: error || 'Error no especificado', trabajoId, mensaje: `Trabajo ${tipo} falló.` },
        realizadoPor: 'SYSTEM_WORKER',
      });
    }

    return NextResponse.json({ success: true, message: 'Webhook procesado y auditoría registrada' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
