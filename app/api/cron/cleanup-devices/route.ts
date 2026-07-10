import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  try {
    // Proteger el endpoint en producción usando el secreto de Vercel Cron
    const authHeader = req.headers.get('authorization');
    if (process.env.NODE_ENV === 'production') {
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    console.log('[CRON_CLEANUP] Iniciando limpieza de dispositivos recordados vencidos o revocados...');

    const now = new Date();

    // 1. Eliminar los dispositivos cuya fecha de expiración ya pasó
    const expiredResult = await prisma.dispositivoRecordado.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    // 2. Eliminar dispositivos revocados hace más de 30 días
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const revokedResult = await prisma.dispositivoRecordado.deleteMany({
      where: {
        revokedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    console.log(
      `[CRON_CLEANUP] Limpieza completada. Eliminados: ${expiredResult.count} expirados, ${revokedResult.count} revocados antiguos.`
    );

    return NextResponse.json({
      success: true,
      mensaje: 'Limpieza de dispositivos recordados completada con éxito',
      eliminadosExpirados: expiredResult.count,
      eliminadosRevocados: revokedResult.count,
    });
  } catch (error: any) {
    console.error('[CRON_CLEANUP_ERROR] Error al limpiar dispositivos recordados:', error);
    return NextResponse.json(
      { error: 'Error interno al procesar la limpieza' },
      { status: 500 }
    );
  }
}
