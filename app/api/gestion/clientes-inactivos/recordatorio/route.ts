import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { logAudit, getClientIp } from '@/lib/audit/audit-logger';

export async function POST(req: NextRequest) {
  try {
    const { userId, userRole, userEmail } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { clienteId, message, status, channel } = body;
    const forzar = req.nextUrl.searchParams.get('forzar') === 'true';

    if (!clienteId) {
      return NextResponse.json({ error: 'Falta el id del cliente' }, { status: 400 });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId }
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const now = new Date();

    // Check if a reminder was sent in the last 7 days
    const lastReminder = await prisma.auditLog.findFirst({
      where: {
        entityType: 'Cliente',
        entityId: clienteId,
        module: 'CLIENTES_INACTIVOS',
        action: 'REMINDER_SENT',
        status: 'SUCCESS'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (lastReminder && !forzar) {
      const diffMs = now.getTime() - new Date(lastReminder.createdAt).getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffDays < 7) {
        return NextResponse.json({
          advertencia: true,
          mensaje: `Ya se le envió un recordatorio a este cliente hace ${diffDays} día(s).`,
          diasDesdeUltimo: diffDays,
          fechaUltimo: lastReminder.createdAt
        }, { status: 200 });
      }
    }

    // Log the audit event for this reminder
    await logAudit({
      action: 'REMINDER_SENT',
      module: 'CLIENTES_INACTIVOS',
      status: status || 'SUCCESS',
      userId: userId,
      userRole: userRole,
      userEmail: userEmail,
      entityType: 'Cliente',
      entityId: clienteId,
      entityName: cliente.nombre,
      description: `Recordatorio enviado a ${cliente.nombre} por ${channel || 'WHATSAPP'}.`,
      metadata: {
        channel: channel || 'WHATSAPP',
        message: message || '',
      },
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
    });

    return NextResponse.json({
      exito: true,
      mensaje: 'Recordatorio registrado exitosamente'
    }, { status: 201 });

  } catch (error: any) {
    console.error('[/api/gestion/clientes-inactivos/recordatorio]', error);
    return NextResponse.json({ error: 'Error al registrar el recordatorio: ' + error.message }, { status: 500 });
  }
}
