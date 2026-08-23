import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { getClientIp, logAudit } from '@/lib/audit/audit-logger';
import { updateWaitlistSchema } from '@/lib/validation/waitlist-schemas';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, userRole, userEmail } = getUserContext(req);
  if (!userId || !userRole) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (userRole === 'TECH_SUPPORT') return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  const parsed = updateWaitlistSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Cambio inválido.' }, { status: 400 });
  const { id } = await params;
  const current = await prisma.listaEspera.findUnique({ where: { id }, include: { cliente: { select: { nombre: true } } } });
  if (!current) return NextResponse.json({ error: 'Entrada de lista de espera no encontrada.' }, { status: 404 });
  if (userRole === 'EMPLEADO' && current.empleadoId && current.empleadoId !== userId) {
    return NextResponse.json({ error: 'Esta solicitud está asignada a otro profesional.' }, { status: 403 });
  }

  const entrada = await prisma.listaEspera.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.estado === 'CONTACTADO' ? { contactedAt: new Date() } : {}),
    },
    include: { cliente: true, servicio: true, profesional: true },
  });
  await logAudit({
    action: 'WAITLIST_UPDATED', module: 'CITAS', status: 'SUCCESS', userId, userRole, userEmail,
    entityType: 'ListaEspera', entityId: id, entityName: current.cliente.nombre,
    description: `Se actualizó la solicitud de espera de ${current.cliente.nombre}.`, beforeData: current, afterData: parsed.data,
    ipAddress: getClientIp(req.headers), userAgent: req.headers.get('user-agent'),
  });
  return NextResponse.json({ entrada });
}

