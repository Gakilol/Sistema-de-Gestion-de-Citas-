import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { obtenerCabecerasFirma } from '@/lib/backup-hmac';

// ─── GET /api/backups/[id]/download (Solicitar enlace de descarga firmado)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const backup = await prisma.historialBackup.findUnique({
      where: { id },
    });

    if (!backup || backup.status === 'DELETED') {
      return NextResponse.json({ error: 'El respaldo no existe o ha sido eliminado.' }, { status: 404 });
    }

    const workerUrl = process.env.BACKUP_WORKER_URL;
    if (!workerUrl) {
      return NextResponse.json({ error: 'BACKUP_WORKER_URL no está configurada.' }, { status: 500 });
    }

    // Solicitar la URL firmada al worker externo usando firma HMAC
    const payload = { storageKey: backup.storageKey };
    const headers = obtenerCabecerasFirma(payload);

    const response = await fetch(`${workerUrl}/api/worker/download-url`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Error en worker al solicitar descarga: ${errorText}` }, { status: 502 });
    }

    const data = await response.json();
    const signedUrl = data.url;

    if (!signedUrl) {
      return NextResponse.json({ error: 'No se recibió la URL firmada desde el worker.' }, { status: 502 });
    }

    // Registrar descarga en auditoría
    await registrarAuditoria({
      entidad: 'BaseDeDatos',
      entidadId: id,
      accion: 'ACTUALIZAR',
      detalles: { accion: 'DESCARGA_BACKUP', archivo: backup.fileName },
      realizadoPor: userId,
    });

    // Redirigir al usuario al enlace firmado de S3 para iniciar la descarga directamente
    return NextResponse.redirect(signedUrl);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
