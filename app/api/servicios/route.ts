import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

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
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden crear servicios' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, descripcion, duracion, categoria_id, precio } = body;

    // Validaciones de precio
    const precioNum = Number(precio);
    if (precio === undefined || precio === null || isNaN(precioNum) || precioNum < 0) {
      return NextResponse.json({ error: 'El precio debe ser un número válido no negativo' }, { status: 400 });
    }

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
        precio: precioNum,
      },
    });

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: 'SERVICE_CREATED',
      module: 'SERVICIOS',
      status: 'SUCCESS',
      userId: req.headers.get('x-user-id'),
      userRole: userRole,
      userEmail: req.headers.get('x-user-email'),
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
