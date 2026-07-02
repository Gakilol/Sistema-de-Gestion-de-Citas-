import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { getUserContext } from '@/lib/auth-helpers';

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, userRole, userEmail } = getUserContext(req);
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden crear servicios' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, descripcion, duracion, categoria_id } = body;

    let legacyCategoria = body.categoria || null;
    if (categoria_id) {
      const cat = await prisma.categoria.findUnique({ where: { id: categoria_id } });
      if (cat) {
        legacyCategoria = cat.nombre;
      }
    }

    const servicio = await prisma.servicio.create({
      data: {
        nombre,
        descripcion,
        duracion: Number(duracion),
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
