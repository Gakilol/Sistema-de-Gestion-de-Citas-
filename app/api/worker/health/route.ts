import { NextResponse, NextRequest } from 'next/server';
import { obtenerCabecerasFirma } from '@/lib/backup-hmac';

// ─── GET /api/worker/health (Verificar disponibilidad del worker)
export async function GET(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const workerUrl = process.env.BACKUP_WORKER_URL;
    if (!workerUrl) {
      return NextResponse.json({
        status: 'unavailable',
        error: 'BACKUP_WORKER_URL no está configurada en las variables de entorno de Vercel.',
      });
    }

    const headers = obtenerCabecerasFirma();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos de timeout

    try {
      const response = await fetch(`${workerUrl}/internal/health`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json({
          status: 'unavailable',
          error: `Error de respuesta del Worker (${response.status})`,
        });
      }

      const data = await response.json();
      return NextResponse.json({
        status: 'available',
        version: data.version || '1.0.0',
        lastJobAt: data.lastJobAt,
        queueStatus: data.queueStatus || 'idle',
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      return NextResponse.json({
        status: 'unavailable',
        error: err.name === 'AbortError' ? 'El servidor del Worker no respondió a tiempo (Timeout).' : err.message,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
