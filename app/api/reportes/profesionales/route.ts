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
      _sum: { monto: true },
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
          ingresosReales: 0, ingresosProyectados: 0, perdidasEstimadas: 0,
        };
      }
      const count = row._count.id;
      const monto = row._sum.monto ? Number(row._sum.monto) : 0;
      empleadoStats[row.empleado_id].total += count;
      if (row.estado === 'COMPLETADA') {
        empleadoStats[row.empleado_id].completadas += count;
        empleadoStats[row.empleado_id].ingresosReales += monto;
      } else if (row.estado === 'CANCELADA') {
        empleadoStats[row.empleado_id].canceladas += count;
        empleadoStats[row.empleado_id].perdidasEstimadas += monto;
      } else if (row.estado === 'NO_SHOW') {
        empleadoStats[row.empleado_id].noShow += count;
        empleadoStats[row.empleado_id].perdidasEstimadas += monto;
      } else {
        empleadoStats[row.empleado_id].otras += count;
        if (['PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'REPROGRAMADA'].includes(row.estado)) {
          empleadoStats[row.empleado_id].ingresosProyectados += monto;
        }
      }
    }

    const porEmpleado = Object.values(empleadoStats).map((e: any) => {
      const citasPasadas = e.completadas + e.noShow;
      return {
        ...e,
        tasaAsistencia:  safeRate(e.completadas, citasPasadas),
        tasaCancelacion: safeRate(e.canceladas,  e.total),
      };
    }).sort((a, b) => b.ingresosReales - a.ingresosReales); // Ordenar por ingresos reales

    // Performance by service
    const citaServicios = await prisma.citaServicio.findMany({
      where: {
        cita: baseWhere
      },
      select: {
        servicio_id: true,
        precio: true,
        cita: {
          select: {
            estado: true
          }
        }
      }
    });

    const servIds = [...new Set(citaServicios.map(r => r.servicio_id))];
    const servs   = await prisma.servicio.findMany({
      where: { id: { in: servIds } },
      select: { id: true, nombre: true, categoria: true },
    });
    const servMap = Object.fromEntries(servs.map(s => [s.id, s]));

    const servicioStats: Record<string, any> = {};
    for (const cs of citaServicios) {
      const sId = cs.servicio_id;
      const estado = cs.cita.estado;
      const precio = cs.precio ? Number(cs.precio) : 0;

      if (!servicioStats[sId]) {
        servicioStats[sId] = {
          id: sId,
          nombre: servMap[sId]?.nombre || '—',
          categoria: servMap[sId]?.categoria || '—',
          total: 0, completadas: 0, canceladas: 0, noShow: 0,
          ingresosReales: 0, ingresosProyectados: 0, perdidasEstimadas: 0,
        };
      }

      servicioStats[sId].total += 1;
      if (estado === 'COMPLETADA') {
        servicioStats[sId].completadas += 1;
        servicioStats[sId].ingresosReales += precio;
      } else if (estado === 'CANCELADA') {
        servicioStats[sId].canceladas += 1;
        servicioStats[sId].perdidasEstimadas += precio;
      } else if (estado === 'NO_SHOW') {
        servicioStats[sId].noShow += 1;
        servicioStats[sId].perdidasEstimadas += precio;
      } else {
        if (['PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'REPROGRAMADA'].includes(estado)) {
          servicioStats[sId].ingresosProyectados += precio;
        }
      }
    }

    const porServicio = Object.values(servicioStats).map((s: any) => {
      const citasPasadas = s.completadas + s.noShow;
      return {
        ...s,
        tasaAsistencia:  safeRate(s.completadas, citasPasadas),
        tasaCancelacion: safeRate(s.canceladas, s.total),
      };
    }).sort((a, b) => b.ingresosReales - a.ingresosReales); // Ordenar por ingresos reales

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
