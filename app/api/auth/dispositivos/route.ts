import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { hashRememberToken } from '@/lib/remember-device';
import { logAudit, getClientIp } from '@/lib/audit/audit-logger';

/**
 * GET /api/auth/dispositivos
 * Retorna todos los dispositivos recordados activos del usuario autenticado.
 */
export async function GET(req: NextRequest) {
  const { userId } = getUserContext(req);

  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const rememberToken = req.cookies.get('remember_token')?.value;
    const currentHash = rememberToken ? hashRememberToken(rememberToken) : null;

    const dispositivos = await prisma.dispositivoRecordado.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
        tokenHash: true,
      },
    });

    const output = dispositivos.map((d) => ({
      id: d.id,
      deviceName: d.deviceName || 'Dispositivo desconocido',
      ipAddress: d.ipAddress || 'IP desconocida',
      createdAt: d.createdAt,
      lastUsedAt: d.lastUsedAt || d.createdAt,
      isCurrent: currentHash !== null && d.tokenHash === currentHash,
    }));

    return NextResponse.json(output);
  } catch (error: any) {
    console.error('[GET_DISPOSITIVOS_ERROR]', error);
    return NextResponse.json({ error: 'Error al obtener dispositivos' }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/dispositivos
 * Revoca uno o todos los dispositivos recordados del usuario.
 */
export async function DELETE(req: NextRequest) {
  const { userId, userEmail, userRole } = getUserContext(req);
  const ipAddress = getClientIp(req.headers);
  const userAgent = req.headers.get('user-agent') || 'desconocido';

  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const revokeAll = searchParams.get('all') === 'true';
    const deviceId = searchParams.get('id');

    const rememberToken = req.cookies.get('remember_token')?.value;
    const currentHash = rememberToken ? hashRememberToken(rememberToken) : null;

    const response = NextResponse.json({ mensaje: 'Dispositivo(s) revocado(s) exitosamente' });

    if (revokeAll) {
      // Revocar todos los dispositivos del usuario
      await prisma.dispositivoRecordado.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      // Registrar auditoría
      await logAudit({
        action: 'REMEMBER_DEVICES_REVOKED_ALL',
        module: 'AUTH',
        status: 'SUCCESS',
        userId,
        userName: userEmail || undefined,
        userEmail: userEmail || undefined,
        userRole: userRole || undefined,
        description: `Se cerró la sesión en todos los dispositivos para el usuario ${userEmail}`,
        ipAddress,
        userAgent,
      });

      // Borrar la cookie remember_token local si existía
      if (rememberToken) {
        response.cookies.set('remember_token', '', { path: '/', maxAge: 0 });
      }

      return response;
    }

    if (!deviceId) {
      return NextResponse.json({ error: 'Falta el ID del dispositivo a revocar' }, { status: 400 });
    }

    // Buscar el dispositivo para asegurarnos de que pertenece al usuario
    const dispositivo = await prisma.dispositivoRecordado.findFirst({
      where: {
        id: deviceId,
        userId,
      },
    });

    if (!dispositivo) {
      return NextResponse.json({ error: 'Dispositivo no encontrado o no pertenece a su usuario' }, { status: 404 });
    }

    // Marcar como revocado
    await prisma.dispositivoRecordado.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });

    // Registrar auditoría
    await logAudit({
      action: 'REMEMBER_DEVICE_REVOKED',
      module: 'AUTH',
      status: 'SUCCESS',
      userId,
      userName: userEmail || undefined,
      userEmail: userEmail || undefined,
      userRole: userRole || undefined,
      description: `Se revocó el dispositivo recordado "${dispositivo.deviceName || 'desconocido'}" para ${userEmail}`,
      ipAddress,
      userAgent,
      metadata: { dispositivoId: deviceId },
    });

    // Si el dispositivo revocado es el dispositivo actual, borramos la cookie
    if (currentHash && dispositivo.tokenHash === currentHash) {
      response.cookies.set('remember_token', '', { path: '/', maxAge: 0 });
    }

    return response;
  } catch (error: any) {
    console.error('[DELETE_DISPOSITIVO_ERROR]', error);
    return NextResponse.json({ error: 'Error al revocar dispositivo' }, { status: 500 });
  }
}
