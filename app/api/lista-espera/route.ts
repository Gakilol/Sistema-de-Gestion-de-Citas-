import { EstadoListaEspera } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { getClientIp, logAudit } from '@/lib/audit/audit-logger';
import { parseLocalDateToUTC } from '@/lib/timezone';
import { createWaitlistSchema } from '@/lib/validation/waitlist-schemas';

export async function GET(req: NextRequest) {
  const { userId, userRole } = getUserContext(req);
  if (!userId || !userRole) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const estadoParam = req.nextUrl.searchParams.get('estado');
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 50) || 50));
  const estado = estadoParam && Object.values(EstadoListaEspera).includes(estadoParam as EstadoListaEspera)
    ? estadoParam as EstadoListaEspera
    : undefined;

  const entradas = await prisma.listaEspera.findMany({
    where: {
      ...(estado ? { estado } : {}),
      ...(q ? { cliente: { OR: [
        { nombre: { contains: q, mode: 'insensitive' } },
        { telefono: { contains: q, mode: 'insensitive' } },
      ] } } : {}),
      ...(userRole === 'EMPLEADO' ? { OR: [{ empleadoId: null }, { empleadoId: userId }] } : {}),
    },
    include: {
      cliente: { select: { id: true, nombre: true, telefono: true } },
      servicio: { select: { id: true, nombre: true, duracion: true } },
      profesional: { select: { id: true, nombre: true } },
      creador: { select: { id: true, nombre: true } },
    },
    orderBy: [{ prioridad: 'desc' }, { createdAt: 'asc' }],
    take: limit,
  });

  return NextResponse.json({
    entradas: entradas.map((entrada: (typeof entradas)[number]) => ({
      ...entrada,
      cliente: userRole === 'TECH_SUPPORT' ? { ...entrada.cliente, telefono: null } : entrada.cliente,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { userId, userRole, userEmail } = getUserContext(req);
  if (!userId || !userRole) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (userRole === 'TECH_SUPPORT') return NextResponse.json({ error: 'Soporte técnico no puede agregar clientes a la lista de espera.' }, { status: 403 });
  const parsed = createWaitlistSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos de lista de espera inválidos.' }, { status: 400 });
  const data = parsed.data;

  const [cliente, servicio, profesional, duplicado] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: data.clienteId }, select: { id: true, nombre: true } }),
    data.servicioId ? prisma.servicio.findFirst({ where: { id: data.servicioId, activo: true }, select: { id: true } }) : null,
    data.empleadoId ? prisma.empleado.findFirst({ where: { id: data.empleadoId, activo: true, esAgendable: true }, select: { id: true } }) : null,
    prisma.listaEspera.findFirst({ where: { clienteId: data.clienteId, servicioId: data.servicioId ?? null, estado: { in: ['ESPERANDO', 'CONTACTADO'] } }, select: { id: true } }),
  ]);
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
  if (data.servicioId && !servicio) return NextResponse.json({ error: 'Servicio no disponible.' }, { status: 400 });
  if (data.empleadoId && !profesional) return NextResponse.json({ error: 'Profesional no disponible.' }, { status: 400 });
  if (duplicado) return NextResponse.json({ error: 'Este cliente ya está esperando por el mismo servicio.' }, { status: 409 });

  const entrada = await prisma.listaEspera.create({
    data: {
      clienteId: data.clienteId,
      servicioId: data.servicioId || null,
      empleadoId: data.empleadoId || null,
      fechaDesde: data.fechaDesde ? parseLocalDateToUTC(data.fechaDesde) : null,
      fechaHasta: data.fechaHasta ? parseLocalDateToUTC(data.fechaHasta) : null,
      jornadaPreferida: data.jornadaPreferida || null,
      notas: data.notas || null,
      prioridad: data.prioridad,
      createdBy: userId,
    },
    include: { cliente: true, servicio: true, profesional: true },
  });
  await logAudit({
    action: 'WAITLIST_CREATED', module: 'CITAS', status: 'SUCCESS', userId, userRole, userEmail,
    entityType: 'ListaEspera', entityId: entrada.id, entityName: cliente.nombre,
    description: `${cliente.nombre} fue agregado a la lista de espera.`, afterData: data,
    ipAddress: getClientIp(req.headers), userAgent: req.headers.get('user-agent'),
  });
  return NextResponse.json({ entrada }, { status: 201 });
}
