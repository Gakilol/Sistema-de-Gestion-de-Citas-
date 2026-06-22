import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireReporteRole, parseReportFilters, safeRate, computeDelta } from '@/lib/reportes-utils';

export async function GET(req: NextRequest) {
  const authError = requireReporteRole(req);
  if (authError) return authError;

  const parsed = parseReportFilters(req);
  if ('error' in parsed) return parsed.error;
  const { filters } = parsed;

  try {
    const now = new Date();
    const empFilter = filters.empleadoId ? Prisma.sql`AND "empleado_id" = ${filters.empleadoId}` : Prisma.empty;

    // Attendance rate: only past appointments (fecha <= now)
    const pastWhere = {
      fecha: { gte: filters.from, lte: filters.to <= now ? filters.to : now },
      estado: { notIn: ['CANCELADA', 'PENDIENTE', 'CONFIRMADA', 'REPROGRAMADA'] as any },
      ...(filters.empleadoId ? { empleado_id: filters.empleadoId } : {}),
      ...(filters.servicioId  ? { servicio_id: filters.servicioId  } : {}),
    };

    const [completadas, noShow, pastPrevCompletadas, pastPrevNoShow] = await Promise.all([
      prisma.cita.count({ where: { ...pastWhere, estado: 'COMPLETADA' } }),
      prisma.cita.count({ where: { ...pastWhere, estado: 'NO_SHOW'    } }),
      filters.compare ? prisma.cita.count({
        where: {
          fecha: { gte: filters.fromPrev, lte: filters.toPrev <= now ? filters.toPrev : now },
          estado: 'COMPLETADA',
          ...(filters.empleadoId ? { empleado_id: filters.empleadoId } : {}),
        }
      }) : Promise.resolve(0),
      filters.compare ? prisma.cita.count({
        where: {
          fecha: { gte: filters.fromPrev, lte: filters.toPrev <= now ? filters.toPrev : now },
          estado: 'NO_SHOW',
          ...(filters.empleadoId ? { empleado_id: filters.empleadoId } : {}),
        }
      }) : Promise.resolve(0),
    ]);

    const citasPasadas     = completadas + noShow;
    const tasaAsistencia   = safeRate(completadas, citasPasadas);
    const tasaNoShow       = safeRate(noShow,       citasPasadas);
    const citasPasadasPrev = pastPrevCompletadas + pastPrevNoShow;

    // Trend by week
    const tendenciaRaw: any[] = await prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('week', "fecha"), 'YYYY-MM-DD') AS semana,
        COUNT(*) FILTER (WHERE "estado" = 'COMPLETADA') AS completadas,
        COUNT(*) FILTER (WHERE "estado" = 'NO_SHOW')    AS no_show,
        COUNT(*) FILTER (WHERE "estado" NOT IN ('CANCELADA', 'PENDIENTE', 'CONFIRMADA', 'REPROGRAMADA')) AS pasadas
      FROM "Cita"
      WHERE "fecha" >= ${filters.from} AND "fecha" <= ${filters.to}
        ${empFilter}
      GROUP BY semana
      ORDER BY semana
    `;
    const tendencia = tendenciaRaw.map(r => ({
      semana:        r.semana,
      completadas:   Number(r.completadas),
      noShow:        Number(r.no_show),
      tasaAsistencia: safeRate(Number(r.completadas), Number(r.pasadas)),
    }));

    // Attendance by professional
    const porEmpleadoRaw = await prisma.cita.groupBy({
      by: ['empleado_id'],
      where: { fecha: { gte: filters.from, lte: filters.to }, estado: { in: ['COMPLETADA', 'NO_SHOW'] } },
      _count: { id: true },
    });
    const empIds = porEmpleadoRaw.map(r => r.empleado_id);
    const emps   = await prisma.empleado.findMany({ where: { id: { in: empIds } }, select: { id: true, nombre: true } });
    const empMap = Object.fromEntries(emps.map(e => [e.id, e.nombre]));

    const completadasByEmp = await prisma.cita.groupBy({
      by: ['empleado_id'],
      where: { fecha: { gte: filters.from, lte: filters.to }, estado: 'COMPLETADA' },
      _count: { id: true },
    });
    const completadasEmpMap = Object.fromEntries(completadasByEmp.map(r => [r.empleado_id, r._count.id]));

    const porEmpleado = porEmpleadoRaw.map(r => {
      const total = r._count.id;
      const comp  = completadasEmpMap[r.empleado_id] || 0;
      const tasa  = safeRate(comp, total);
      return {
        nombre: empMap[r.empleado_id] || '—',
        completadas: comp,
        total,
        tasaAsistencia: tasa,
        nivel: tasa >= 90 ? 'excelente' : tasa >= 75 ? 'aceptable' : 'riesgo',
      };
    }).sort((a, b) => b.tasaAsistencia - a.tasaAsistencia);

    // Attendance by service
    const porServicioRaw = await prisma.cita.groupBy({
      by: ['servicio_id'],
      where: { fecha: { gte: filters.from, lte: filters.to }, estado: { in: ['COMPLETADA', 'NO_SHOW'] } },
      _count: { id: true },
    });
    const completadasByServ = await prisma.cita.groupBy({
      by: ['servicio_id'],
      where: { fecha: { gte: filters.from, lte: filters.to }, estado: 'COMPLETADA' },
      _count: { id: true },
    });
    const completadasServMap = Object.fromEntries(completadasByServ.map(r => [r.servicio_id, r._count.id]));
    const servicioIds = porServicioRaw.map(r => r.servicio_id);
    const serviciosDb = await prisma.servicio.findMany({ where: { id: { in: servicioIds } }, select: { id: true, nombre: true } });
    const servicioMap = Object.fromEntries(serviciosDb.map(s => [s.id, s.nombre]));

    const porServicio = porServicioRaw.map(r => {
      const total = r._count.id;
      const comp  = completadasServMap[r.servicio_id] || 0;
      const tasa  = safeRate(comp, total);
      return {
        nombre: servicioMap[r.servicio_id] || '—',
        completadas: comp,
        total,
        tasaAsistencia: tasa,
        nivel: tasa >= 90 ? 'excelente' : tasa >= 75 ? 'aceptable' : 'riesgo',
      };
    }).sort((a, b) => b.tasaAsistencia - a.tasaAsistencia);

    return NextResponse.json({
      resumen: {
        completadas,
        noShow,
        citasPasadas,
        tasaAsistencia,
        tasaNoShow,
        nivel: tasaAsistencia >= 90 ? 'excelente' : tasaAsistencia >= 75 ? 'aceptable' : 'riesgo',
      },
      deltas: filters.compare ? {
        tasaAsistencia: computeDelta(tasaAsistencia, safeRate(pastPrevCompletadas, citasPasadasPrev)),
        completadas:    computeDelta(completadas, pastPrevCompletadas),
      } : null,
      tendencia,
      porEmpleado,
      porServicio,
      meta: { from: filters.rawFrom, to: filters.rawTo, compare: filters.compare, timezone: 'America/Costa_Rica' },
    });
  } catch (err: any) {
    console.error('[/api/reportes/asistencia]', err);
    return NextResponse.json({ error: 'Error interno al generar el reporte de asistencia.' }, { status: 500 });
  }
}
