import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// ─── GET /api/auditorias
// Devuelve el listado de logs de auditoría.
// Solo accesible para ADMIN y TECH_SUPPORT.
export async function GET(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const entidad  = req.nextUrl.searchParams.get('entidad') || '';
    const accion   = req.nextUrl.searchParams.get('accion') || '';
    const desde    = req.nextUrl.searchParams.get('desde') || '';
    const hasta    = req.nextUrl.searchParams.get('hasta') || '';
    const limit    = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '100', 10), 500);

    const where: any = {};
    if (entidad) where.entidad = entidad;
    if (accion) where.accion = accion;
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59.999Z');
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: limit,
    });

    return NextResponse.json({ logs, total: logs.length }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
