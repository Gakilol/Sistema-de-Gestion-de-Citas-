import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireReporteRole, parseReportFilters } from '@/lib/reportes-utils';
import { syncCitaEstados } from '@/lib/automatizacion';

/**
 * GET /api/reportes
 * Legacy route kept for backward compatibility with the original reportes UI.
 * Adds proper role protection. Now calls sub-routes for new analytics.
 */
export async function GET(req: NextRequest) {
  const authError = requireReporteRole(req);
  if (authError) return authError;

  try {
    await syncCitaEstados();

    const tipo  = req.nextUrl.searchParams.get('tipo') ?? 'citas';
    const parsed = parseReportFilters(req);
    if ('error' in parsed) return parsed.error;
    const { filters } = parsed;

    if (tipo === 'citas') {
      const [byEstado, byEmpleado, byServicio] = await Promise.all([
        prisma.cita.groupBy({
          by: ['estado'],
          where: { fecha: { gte: filters.from, lte: filters.to } },
          _count: { id: true },
        }),
        prisma.cita.groupBy({
          by: ['empleado_id'],
          where: { fecha: { gte: filters.from, lte: filters.to } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
        prisma.cita.groupBy({
          by: ['servicio_id'],
          where: { fecha: { gte: filters.from, lte: filters.to } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 8,
        }),
      ]);

      const empIds  = byEmpleado.map(e => e.empleado_id);
      const servIds = byServicio.map(s => s.servicio_id);
      const [emps, servs] = await Promise.all([
        prisma.empleado.findMany({ where: { id: { in: empIds  } }, select: { id: true, nombre: true } }),
        prisma.servicio.findMany({ where: { id: { in: servIds } }, select: { id: true, nombre: true } }),
      ]);
      const empMap  = Object.fromEntries(emps.map(e  => [e.id, e.nombre]));
      const servMap = Object.fromEntries(servs.map(s => [s.id, s.nombre]));

      return NextResponse.json({
        porEstado:   byEstado.map(e  => ({ estado: e.estado,   cantidad: e._count.id })),
        porEmpleado: byEmpleado.map(e => ({ nombre: empMap[e.empleado_id] ?? '—', citas: e._count.id })),
        porServicio: byServicio.map(s => ({ nombre: servMap[s.servicio_id] ?? '—', cantidad: s._count.id })),
      });
    }

    if (tipo === 'empleados') {
      const data = await prisma.cita.groupBy({
        by: ['empleado_id'],
        where: { fecha: { gte: filters.from, lte: filters.to } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });
      const ids  = data.map(d => d.empleado_id);
      const emps = await prisma.empleado.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, especialidad: true } });
      const empMap = Object.fromEntries(emps.map(e => [e.id, e]));
      return NextResponse.json({
        data: data.map(d => ({
          nombre:       empMap[d.empleado_id]?.nombre       ?? '—',
          especialidad: empMap[d.empleado_id]?.especialidad ?? '—',
          citas:        d._count.id,
        })),
      });
    }

    return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
