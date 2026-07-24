import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { registrarAuditoria } from '@/lib/auditoria';
import { getUserContext } from '@/lib/auth-helpers';

const CreateServicioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150).trim(),
  descripcion: z.string().max(1000).optional().nullable(),
  duracion: z.number().int('La duración debe ser en minutos enteros').min(1).max(1440),
  categoria_id: z.string().uuid().optional().nullable(),
  categoria: z.string().max(100).optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const busqueda = req.nextUrl.searchParams.get('q') || '';
    const servicios = await prisma.servicio.findMany({
      where: {
        OR: busqueda ? [
          { nombre: { contains: busqueda, mode: 'insensitive' } },
          { descripcion: { contains: busqueda, mode: 'insensitive' } },
          { categoria: { contains: busqueda, mode: 'insensitive' } },
        ] : undefined,
      },
      include: {
        categoriaRel: true
      },
      orderBy: { nombre: 'asc' },
    });
    return NextResponse.json({ servicios }, { status: 200 });
  } catch (error: any) {
    console.error('[SERVICIOS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Error interno al consultar servicios' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, userRole, userEmail } = getUserContext(req);
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden crear servicios' }, { status: 403 });
    }

    const rawBody = await req.json();
    const parseResult = CreateServicioSchema.safeParse({
      ...rawBody,
      duracion: rawBody.duracion !== undefined ? Number(rawBody.duracion) : undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Datos de servicio inválidos', detalles: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { nombre, descripcion, duracion, categoria_id, categoria: catName } = parseResult.data;

    let legacyCategoria = catName || null;
    if (categoria_id) {
      const cat = await prisma.categoria.findUnique({ where: { id: categoria_id } });
      if (cat) {
        legacyCategoria = cat.nombre;
      }
    }

    const servicio = await prisma.servicio.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        duracion,
        categoria: legacyCategoria,
        categoria_id: categoria_id || null,
      },
    });

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: 'SERVICE_CREATED',
      module: 'SERVICIOS',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail,
      entityType: 'Servicio',
      entityId: servicio.id,
      entityName: servicio.nombre,
      description: `Servicio ${servicio.nombre} creado exitosamente.`,
      afterData: servicio,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
    });

    return NextResponse.json({ servicio, mensaje: 'Servicio creado exitosamente' }, { status: 201 });
  } catch (error: any) {
    console.error('[SERVICIOS_POST_ERROR]', error);
    return NextResponse.json({ error: 'No se pudo crear el servicio' }, { status: 500 });
  }
}
