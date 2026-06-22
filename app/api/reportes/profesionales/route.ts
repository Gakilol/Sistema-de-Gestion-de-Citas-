import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireReporteRole, parseReportFilters, safeRate } from '@/lib/reportes-utils';

export async function GET(req: NextRequest) {
  const authError = requireReporteRole(req);
  if (authError) return authError;

  const parsed = parseReportFilters(req);
  if ('error' in parsed) return parsed.error;
  const { filters } = parsed;

  try {
    const baseWhere = { fecha: { gte: filters.from, lte: filters.to } };

    // Performance by professional
    const empleadoGroupBy = await prisma.cita.groupBy({
      by: ['empleado_id', 'estado'],
      where: baseWhere,
      _count: { id: true },
    });

    const empIds = [...new Set(empleadoGroupBy.map(r => r.empleado_id))];
    const emps   = await prisma.empleado.findMany({
      where: { id: { in: empIds } },
      select: { id: true, nombre: true, especialidad: true },
    });
    const empMap = Object.fromEntries(emps.map(e => [e.id, e]));

    const empleadoStats: Record<string, any> = {};
    for (const row of empleadoGroupBy) {
      if (!empleadoStats[row.empleado_id]) {
        empleadoStats[row.empleado_id] = {
          id: row.empleado_id,
          nombre: empMap[row.empleado_id]?.nombre || '—',
          especialidad: empMap[row.empleado_id]?.especialidad || '—',
          total: 0, completadas: 0, canceladas: 0, noShow: 0, otras: 0,
        };
      }
      const count = row._count.id;
      empleadoStats[row.empleado_id].total += count;
      if (row.estado === 'COMPLETADA')  empleadoStats[row.empleado_id].completadas += count;
      else if (row.estado === 'CANCELADA')   empleadoStats[row.empleado_id].canceladas  += count;
      else if (row.estado === 'NO_SHOW')     empleadoStats[row.empleado_id].noShow      += count;
      else                                   empleadoStats[row.empleado_id].otras        += count;
    }

    const porEmpleado = Object.values(empleadoStats).map((e: any) => {
      const citasPasadas = e.completadas + e.noShow;
      return {
        ...e,
        tasaAsistencia:  safeRate(e.completadas, citasPasadas),
        tasaCancelacion: safeRate(e.canceladas,  e.total),
      };
    }).sort((a, b) => b.completadas - a.completadas);

    // Performance by service
    const servicioGroupBy = await prisma.cita.groupBy({
      by: ['servicio_id', 'estado'],
      where: baseWhere,
      _count: { id: true },
    });

    const servIds = [...new Set(servicioGroupBy.map(r => r.servicio_id))];
    const servs   = await prisma.servicio.findMany({
      where: { id: { in: servIds } },
      select: { id: true, nombre: true, categoria: true },
    });
    const servMap = Object.fromEntries(servs.map(s => [s.id, s]));

    const servicioStats: Record<string, any> = {};
    for (const row of servicioGroupBy) {
      if (!servicioStats[row.servicio_id]) {
        servicioStats[row.servicio_id] = {
          id: row.servicio_id,
          nombre: servMap[row.servicio_id]?.nombre || '—',
          categoria: servMap[row.servicio_id]?.categoria || '—',
          total: 0, completadas: 0, canceladas: 0, noShow: 0,
        };
      }
      const count = row._count.id;
      servicioStats[row.servicio_id].total += count;
      if (row.estado === 'COMPLETADA')  servicioStats[row.servicio_id].completadas += count;
      else if (row.estado === 'CANCELADA')   servicioStats[row.servicio_id].canceladas  += count;
      else if (row.estado === 'NO_SHOW')     servicioStats[row.servicio_id].noShow      += count;
    }

    const porServicio = Object.values(servicioStats).map((s: any) => {
      const citasPasadas = s.completadas + s.noShow;
      return {
        ...s,
        tasaAsistencia:  safeRate(s.completadas, citasPasadas),
        tasaCancelacion: safeRate(s.canceladas, s.total),
      };
    }).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      porEmpleado,
      porServicio,
      meta: { from: filters.rawFrom, to: filters.rawTo, timezone: 'America/Costa_Rica' },
    });
  } catch (err: any) {
    console.error('[/api/reportes/profesionales]', err);
    return NextResponse.json({ error: 'Error interno al generar el reporte de profesionales.' }, { status: 500 });
  }
}
