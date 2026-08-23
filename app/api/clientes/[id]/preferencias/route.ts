import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { getClientIp, logAudit } from '@/lib/audit/audit-logger';
import { createClientPreferenceSchema } from '@/lib/validation/client-preference-schemas';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, userRole } = getUserContext(req);
  if (!userId || !userRole) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (userRole === 'TECH_SUPPORT') return NextResponse.json({ preferencias: [] });

  const { id } = await params;
  const preferencias = await prisma.clientePreferencia.findMany({
    where: { clienteId: id },
    select: {
      id: true,
      tipo: true,
      titulo: true,
      detalle: true,
      createdAt: true,
      createdBy: true,
      creador: { select: { nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ preferencias });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, userRole, userEmail } = getUserContext(req);
  if (!userId || !userRole) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (userRole === 'TECH_SUPPORT') return NextResponse.json({ error: 'Soporte técnico no puede registrar preferencias privadas.' }, { status: 403 });

  const parsed = createClientPreferenceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Revisa el tipo, título y detalle de la preferencia.' }, { status: 400 });

  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { id }, select: { id: true, nombre: true } });
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });

  const preferencia = await prisma.clientePreferencia.create({
    data: { clienteId: id, createdBy: userId, ...parsed.data },
    include: { creador: { select: { nombre: true } } },
  });

  await logAudit({
    action: 'CLIENT_PREFERENCE_CREATED', module: 'CLIENTES', status: 'SUCCESS', userId, userRole, userEmail,
    entityType: 'ClientePreferencia', entityId: preferencia.id, entityName: cliente.nombre,
    description: `Se agregó ${preferencia.tipo.toLowerCase()} al perfil de ${cliente.nombre}.`,
    afterData: parsed.data, ipAddress: getClientIp(req.headers), userAgent: req.headers.get('user-agent'),
  });
  return NextResponse.json({ preferencia }, { status: 201 });
}

