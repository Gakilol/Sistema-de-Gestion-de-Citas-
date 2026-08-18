import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { logAudit, getClientIp } from '@/lib/audit/audit-logger';
import { validateAndNormalizePhone } from '@/lib/phone';
import { canContactInactiveClient } from '@/lib/inactive-clients';
import { z } from 'zod';

const ReminderSchema = z.object({
  clienteId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  channel: z.literal('WHATSAPP'),
});

export async function POST(req: NextRequest) {
  try {
    const { userId, userRole, userEmail } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = ReminderSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos del recordatorio no válidos' }, { status: 400 });
    }

    const { clienteId, message, channel } = parsed.data;
    const forzar = req.nextUrl.searchParams.get('forzar') === 'true';

    console.info(JSON.stringify({
      event: 'inactive_reminder_requested',
      clienteId,
      userId,
      userRole,
      forzar,
    }));

    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nombre: true, telefono: true },
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    let hasServedClient = false;
    if (userRole === 'EMPLEADO') {
      const appointment = await prisma.cita.findFirst({
        where: { cliente_id: clienteId, empleado_id: userId },
        select: { id: true },
      });
      hasServedClient = Boolean(appointment);
    }

    if (!canContactInactiveClient(userRole, hasServedClient)) {
      return NextResponse.json({ error: 'No tienes permiso para contactar a este cliente' }, { status: 403 });
    }

    const phone = validateAndNormalizePhone(cliente.telefono);
    if (!phone.isValid || !phone.normalized) {
      return NextResponse.json(
        { error: 'El cliente no tiene un número de WhatsApp válido' },
        { status: 400 }
      );
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
        console.info(JSON.stringify({
          event: 'inactive_reminder_rate_limited',
          clienteId,
          userId,
          diffDays,
        }));
        return NextResponse.json({
          advertencia: true,
          mensaje: `Ya se le envió un recordatorio a este cliente hace ${diffDays} día(s).`,
          diasDesdeUltimo: diffDays,
          fechaUltimo: lastReminder.createdAt
        }, { status: 200 });
      }
    }

    // Log the audit event for this reminder
    const auditWritten = await logAudit({
      action: 'REMINDER_SENT',
      module: 'CLIENTES_INACTIVOS',
      status: 'SUCCESS',
      userId: userId,
      userRole: userRole,
      userEmail: userEmail,
      entityType: 'Cliente',
      entityId: clienteId,
      entityName: cliente.nombre,
      description: `Recordatorio enviado a ${cliente.nombre} por ${channel}.`,
      metadata: {
        channel,
        message,
        phoneCountryCode: phone.normalized.slice(0, 3),
      },
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
    });

    if (!auditWritten) {
      throw new Error('No se pudo guardar la auditoría del recordatorio');
    }

    console.info(JSON.stringify({
      event: 'inactive_reminder_registered',
      clienteId,
      userId,
      channel,
    }));

    return NextResponse.json({
      exito: true,
      mensaje: 'Recordatorio registrado exitosamente'
    }, { status: 201 });

  } catch (error: unknown) {
    console.error(JSON.stringify({
      event: 'inactive_reminder_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    return NextResponse.json({ error: 'Error al registrar el recordatorio' }, { status: 500 });
  }
}
