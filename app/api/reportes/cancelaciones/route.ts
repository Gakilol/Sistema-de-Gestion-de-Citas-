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

  const sp = req.nextUrl.searchParams;
  const lateThresholdHours = Math.min(Math.max(parseInt(sp.get('lateHours') || '24'), 1), 168);

  try {
    const baseWhere = {
      fecha:  { gte: filters.from, lte: filters.to },
      estado: 'CANCELADA' as const,
      ...(filters.empleadoId ? { empleado_id: filters.empleadoId } : {}),
      ...(filters.servicioId  ? { servicio_id: filters.servicioId  } : {}),
    };

    const empFilter = filters.empleadoId ? Prisma.sql`AND "empleado_id" = ${filters.empleadoId}` : Prisma.empty;

    const [totalCanceladas, totalCitasPeriodo, prevCanceladas, prevTotal] = await Promise.all([
      prisma.cita.count({ where: baseWhere }),
      prisma.cita.count({ where: { fecha: { gte: filters.from, lte: filters.to } } }),
      filters.compare ? prisma.cita.count({ where: { fecha: { gte: filters.fromPrev, lte: filters.toPrev }, estado: 'CANCELADA' } }) : Promise.resolve(0),
      filters.compare ? prisma.cita.count({ where: { fecha: { gte: filters.fromPrev, lte: filters.toPrev } } }) : Promise.resolve(0),
    ]);

    const tasaCancelacion = safeRate(totalCanceladas, totalCitasPeriodo);

    // Cancellations over time (weekly)
    const tendenciaRaw: any[] = await prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('week', "fecha"), 'YYYY-MM-DD') AS semana,
        COUNT(*) AS total
      FROM "Cita"
      WHERE "fecha" >= ${filters.from}
        AND "fecha" <= ${filters.to}
        AND "estado" = 'CANCELADA'
        ${empFilter}
      GROUP BY semana
      ORDER BY semana
    `;
    const tendencia = tendenciaRaw.map(r => ({ semana: r.semana, total: Number(r.total) }));

    // Cancellations by day of week
    const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const porDiaRaw: any[] = await prisma.$queryRaw`
      SELECT EXTRACT(DOW FROM "fecha")::INT AS dow, COUNT(*) AS total
      FROM "Cita"
      WHERE "fecha" >= ${filters.from} AND "fecha" <= ${filters.to} AND "estado" = 'CANCELADA'
      GROUP BY dow ORDER BY dow
    `;
    const porDia = DIAS_SEMANA.map((dia, i) => {
      const found = porDiaRaw.find(r => Number(r.dow) === i);
      return { dia, total: found ? Number(found.total) : 0 };
    });

    // By professional
    const porEmpleadoRaw = await prisma.cita.groupBy({
      by: ['empleado_id'],
      where: baseWhere,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const empIds = porEmpleadoRaw.map(r => r.empleado_id);
    const emps   = await prisma.empleado.findMany({ where: { id: { in: empIds } }, select: { id: true, nombre: true } });
    const empMap = Object.fromEntries(emps.map(e => [e.id, e.nombre]));
    const porEmpleado = porEmpleadoRaw.map(r => ({ nombre: empMap[r.empleado_id] || '—', total: r._count.id }));

    // By service
    const porServicioRaw = await prisma.cita.groupBy({
      by: ['servicio_id'],
      where: baseWhere,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const servIds = porServicioRaw.map(r => r.servicio_id);
    const servs   = await prisma.servicio.findMany({ where: { id: { in: servIds } }, select: { id: true, nombre: true } });
    const servMap = Object.fromEntries(servs.map(s => [s.id, s.nombre]));
    const porServicio = porServicioRaw.map(r => ({ nombre: servMap[r.servicio_id] || '—', total: r._count.id }));

    // Clients with most cancellations
    const porClienteRaw = await prisma.cita.groupBy({
      by: ['cliente_id', 'cliente_nombre'],
      where: { ...baseWhere, cliente_id: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const clientesConMasCancelaciones = porClienteRaw.map(r => ({
      nombre:    r.cliente_nombre,
      total:     r._count.id,
      clienteId: r.cliente_id,
    }));

    // Late cancellations
    const lateRaw: any[] = await prisma.$queryRaw`
      SELECT COUNT(*) AS total
      FROM "Cita"
      WHERE "estado" = 'CANCELADA'
        AND "cancelled_at" IS NOT NULL
        AND "fecha" >= ${filters.from}
        AND "fecha" <= ${filters.to}
        AND (
          ("fecha"::TIMESTAMP + ("hora" || ':00')::TIME) > "cancelled_at"
          AND ("fecha"::TIMESTAMP + ("hora" || ':00')::TIME) - "cancelled_at"
              < INTERVAL '1 hour' * ${lateThresholdHours}
        )
    `;
    const cancelacionesTardias = Number(lateRaw[0]?.total || 0);
    const porcentajeTardias = safeRate(cancelacionesTardias, totalCanceladas);

    return NextResponse.json({
      resumen: {
        totalCanceladas,
        totalCitasPeriodo,
        tasaCancelacion,
        cancelacionesTardias,
        porcentajeTardias,
        umbralTardias: `Menos de ${lateThresholdHours}h antes`,
      },
      deltas: filters.compare ? {
        totalCanceladas:  computeDelta(totalCanceladas,  prevCanceladas),
        tasaCancelacion:  computeDelta(tasaCancelacion,  safeRate(prevCanceladas, prevTotal)),
      } : null,
      tendencia,
      porDia,
      porEmpleado,
      porServicio,
      clientesConMasCancelaciones,
      nota: 'Si cancelled_at es NULL, las cancelaciones tardías no se pueden calcular con precisión. Sincronice el esquema con database/novacita_complete_schema.sql o ejecute prisma migrate deploy.',
      meta: { from: filters.rawFrom, to: filters.rawTo, lateThresholdHours, timezone: 'America/Costa_Rica' },
    });
  } catch (err: any) {
    console.error('[/api/reportes/cancelaciones]', err);
    return NextResponse.json({ error: 'Error interno al generar el reporte de cancelaciones.' }, { status: 500 });
  }
}
