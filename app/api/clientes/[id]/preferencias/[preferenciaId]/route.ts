import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { getClientIp, logAudit } from '@/lib/audit/audit-logger';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; preferenciaId: string }> }) {
  const { userId, userRole, userEmail } = getUserContext(req);
  if (!userId || !userRole) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id, preferenciaId } = await params;
  const preferencia = await prisma.clientePreferencia.findFirst({ where: { id: preferenciaId, clienteId: id } });
  if (!preferencia) return NextResponse.json({ error: 'Preferencia no encontrada.' }, { status: 404 });
  if (userRole === 'EMPLEADO' && preferencia.createdBy !== userId) {
    return NextResponse.json({ error: 'Solo quien registró esta nota puede eliminarla.' }, { status: 403 });
  }
  if (userRole === 'TECH_SUPPORT') return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  await prisma.clientePreferencia.delete({ where: { id: preferenciaId } });
  await logAudit({
    action: 'CLIENT_PREFERENCE_DELETED', module: 'CLIENTES', status: 'SUCCESS', userId, userRole, userEmail,
    entityType: 'ClientePreferencia', entityId: preferenciaId, description: 'Se eliminó una preferencia del perfil del cliente.',
    beforeData: preferencia, ipAddress: getClientIp(req.headers), userAgent: req.headers.get('user-agent'),
  });
  return NextResponse.json({ ok: true });
}

