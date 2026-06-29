import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireReporteRole, parseReportFilters, safeRate, computeDelta } from '@/lib/reportes-utils';
import { differenceInDays } from 'date-fns';

export async function GET(req: NextRequest) {
  const authError = requireReporteRole(req);
  if (authError) return authError;

  const parsed = parseReportFilters(req);
  if ('error' in parsed) return parsed.error;
  const { filters } = parsed;

  try {
    // Helper to build cita where clause
    const buildWhere = (from: Date, to: Date) => ({
      fecha: { gte: from, lte: to },
      ...(filters.empleadoId ? { empleado_id: filters.empleadoId } : {}),
      ...(filters.servicioId  ? { servicio_id: filters.servicioId  } : {}),
      ...(filters.clienteId   ? { cliente_id:  filters.clienteId   } : {}),
    });

    const [
      // Current period counts
      totalCitas,
      completadas,
      canceladas,
      noShow,
      pendientes,
      confirmadas,
      enProgreso,
      // Previous period counts
      totalPrev,
      completadasPrev,
      canceladasPrev,
      noShowPrev,
      // Current period financials
      ingresosRealesRaw,
      ingresosProyectadosRaw,
      perdidasCancelacionRaw,
      perdidasNoShowRaw,
      // Previous period financials
      ingresosRealesPrevRaw,
      perdidasCancelacionPrevRaw,
      perdidasNoShowPrevRaw,
    ] = await Promise.all([
      // Current counts
      prisma.cita.count({ where: buildWhere(filters.from, filters.to) }),
      prisma.cita.count({ where: { ...buildWhere(filters.from, filters.to), estado: 'COMPLETADA' } }),
      prisma.cita.count({ where: { ...buildWhere(filters.from, filters.to), estado: 'CANCELADA' } }),
      prisma.cita.count({ where: { ...buildWhere(filters.from, filters.to), estado: 'NO_SHOW' } }),
      prisma.cita.count({ where: { ...buildWhere(filters.from, filters.to), estado: 'PENDIENTE' } }),
      prisma.cita.count({ where: { ...buildWhere(filters.from, filters.to), estado: 'CONFIRMADA' } }),
      prisma.cita.count({ where: { ...buildWhere(filters.from, filters.to), estado: 'EN_PROGRESO' } }),
      // Previous counts
      filters.compare ? prisma.cita.count({ where: buildWhere(filters.fromPrev, filters.toPrev) }) : Promise.resolve(0),
      filters.compare ? prisma.cita.count({ where: { ...buildWhere(filters.fromPrev, filters.toPrev), estado: 'COMPLETADA' } }) : Promise.resolve(0),
      filters.compare ? prisma.cita.count({ where: { ...buildWhere(filters.fromPrev, filters.toPrev), estado: 'CANCELADA' } }) : Promise.resolve(0),
      filters.compare ? prisma.cita.count({ where: { ...buildWhere(filters.fromPrev, filters.toPrev), estado: 'NO_SHOW' } }) : Promise.resolve(0),
      // Current financials
      prisma.cita.aggregate({ where: { ...buildWhere(filters.from, filters.to), estado: 'COMPLETADA' }, _sum: { monto: true } }),
      prisma.cita.aggregate({ where: { ...buildWhere(filters.from, filters.to), estado: { in: ['PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'REPROGRAMADA'] } }, _sum: { monto: true } }),
      prisma.cita.aggregate({ where: { ...buildWhere(filters.from, filters.to), estado: 'CANCELADA' }, _sum: { monto: true } }),
      prisma.cita.aggregate({ where: { ...buildWhere(filters.from, filters.to), estado: 'NO_SHOW' }, _sum: { monto: true } }),
      // Previous financials
      filters.compare ? prisma.cita.aggregate({ where: { ...buildWhere(filters.fromPrev, filters.toPrev), estado: 'COMPLETADA' }, _sum: { monto: true } }) : Promise.resolve({ _sum: { monto: null } }),
      filters.compare ? prisma.cita.aggregate({ where: { ...buildWhere(filters.fromPrev, filters.toPrev), estado: 'CANCELADA' }, _sum: { monto: true } }) : Promise.resolve({ _sum: { monto: null } }),
      filters.compare ? prisma.cita.aggregate({ where: { ...buildWhere(filters.fromPrev, filters.toPrev), estado: 'NO_SHOW' }, _sum: { monto: true } }) : Promise.resolve({ _sum: { monto: null } }),
    ]);

    const ingresosReales = ingresosRealesRaw._sum.monto ? Number(ingresosRealesRaw._sum.monto) : 0;
    const ingresosProyectados = ingresosProyectadosRaw._sum.monto ? Number(ingresosProyectadosRaw._sum.monto) : 0;
    const perdidasCancelacion = perdidasCancelacionRaw._sum.monto ? Number(perdidasCancelacionRaw._sum.monto) : 0;
    const perdidasNoShow = perdidasNoShowRaw._sum.monto ? Number(perdidasNoShowRaw._sum.monto) : 0;

    const ingresosRealesPrev = ingresosRealesPrevRaw._sum.monto ? Number(ingresosRealesPrevRaw._sum.monto) : 0;
    const perdidasCancelacionPrev = perdidasCancelacionPrevRaw._sum.monto ? Number(perdidasCancelacionPrevRaw._sum.monto) : 0;
    const perdidasNoShowPrev = perdidasNoShowPrevRaw._sum.monto ? Number(perdidasNoShowPrevRaw._sum.monto) : 0;

    const ticketPromedio = completadas > 0 ? Math.round(ingresosReales / completadas) : 0;
    const ticketPromedioPrev = completadasPrev > 0 ? Math.round(ingresosRealesPrev / completadasPrev) : 0;

    // Citas pasadas = completadas + canceladas + no_show (denominador para tasas)
    const citasPasadas = completadas + canceladas + noShow;
    const tasaAsistencia   = safeRate(completadas, citasPasadas);
    const tasaCancelacion  = safeRate(canceladas,  totalCitas);
    const tasaNoShow       = safeRate(noShow,       citasPasadas);

    // Prev period rates
    const citasPasadasPrev = completadasPrev + canceladasPrev + noShowPrev;
    const tasaAsistenciaPrev  = safeRate(completadasPrev, citasPasadasPrev);
    const tasaCancelacionPrev = safeRate(canceladasPrev,  totalPrev);
    const tasaNoShowPrev      = safeRate(noShowPrev,      citasPasadasPrev);

    // Distinct clients served (completadas only)
    const clientesAtendidosRaw = await prisma.cita.findMany({
      where: { ...buildWhere(filters.from, filters.to), estado: 'COMPLETADA', cliente_id: { not: null } },
      select: { cliente_id: true },
      distinct: ['cliente_id'],
    });
    const clientesAtendidos = clientesAtendidosRaw.length;

    // New clients (first cita in period)
    const clientesNuevosRaw = await prisma.cita.findMany({
      where: { ...buildWhere(filters.from, filters.to), cliente_id: { not: null } },
      select: { cliente_id: true, created_at: true },
    });
    const clienteFirstSeen: Record<string, Date> = {};
    for (const c of clientesNuevosRaw) {
      if (!c.cliente_id) continue;
      if (!clienteFirstSeen[c.cliente_id] || c.created_at < clienteFirstSeen[c.cliente_id]) {
        clienteFirstSeen[c.cliente_id] = c.created_at;
      }
    }
    const clientesNuevos = Object.values(clienteFirstSeen).filter(d => d >= filters.from && d <= filters.to).length;

    // Avg citas per day
    const dias = Math.max(differenceInDays(filters.to, filters.from) + 1, 1);
    const promedioCitasDia = Math.round((totalCitas / dias) * 100) / 100;

    // Most requested day of week
    const empleadoFilter = filters.empleadoId ? Prisma.sql`AND "empleado_id" = ${filters.empleadoId}` : Prisma.empty;
    const servicioFilter = filters.servicioId ? Prisma.sql`AND "servicio_id" = ${filters.servicioId}` : Prisma.empty;
    const diaSemanaRaw: any[] = await prisma.$queryRaw`
      SELECT EXTRACT(DOW FROM "fecha")::INT AS dow, COUNT(*) AS total
      FROM "Cita"
      WHERE "fecha" >= ${filters.from} AND "fecha" <= ${filters.to}
      ${empleadoFilter} ${servicioFilter}
      GROUP BY dow
      ORDER BY total DESC
      LIMIT 1
    `;
    const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaMasSolicitado = diaSemanaRaw.length > 0 ? DIAS_SEMANA[Number(diaSemanaRaw[0].dow)] : 'N/A';

    // Most requested hour
    const horaMasSolicitadaRaw: any[] = await prisma.$queryRaw`
      SELECT SUBSTRING("hora" FROM 1 FOR 2) AS hora_h, COUNT(*) AS total
      FROM "Cita"
      WHERE "fecha" >= ${filters.from} AND "fecha" <= ${filters.to}
      GROUP BY hora_h
      ORDER BY total DESC
      LIMIT 1
    `;
    const horaMasSolicitada = horaMasSolicitadaRaw.length > 0
      ? `${horaMasSolicitadaRaw[0].hora_h}:00 - ${String(Number(horaMasSolicitadaRaw[0].hora_h) + 1).padStart(2, '0')}:00`
      : 'N/A';

    // Most requested service
    const servicioMasSolicitadoRaw = await prisma.cita.groupBy({
      by: ['servicio_id'],
      where: buildWhere(filters.from, filters.to),
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });
    let servicioMasSolicitado = 'N/A';
    if (servicioMasSolicitadoRaw.length > 0) {
      const s = await prisma.servicio.findUnique({ where: { id: servicioMasSolicitadoRaw[0].servicio_id }, select: { nombre: true } });
      servicioMasSolicitado = s?.nombre || 'N/A';
    }

    // Professional with most completed citas
    const empleadoTopRaw = await prisma.cita.groupBy({
      by: ['empleado_id'],
      where: { ...buildWhere(filters.from, filters.to), estado: 'COMPLETADA' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });
    let empleadoTop = 'N/A';
    if (empleadoTopRaw.length > 0) {
      const e = await prisma.empleado.findUnique({ where: { id: empleadoTopRaw[0].empleado_id }, select: { nombre: true } });
      empleadoTop = e?.nombre || 'N/A';
    }

    // Late cancellations (< 24h before appointment)
    const cancelacionesTardiasRaw: any[] = await prisma.$queryRaw`
      SELECT COUNT(*) AS total
      FROM "Cita"
      WHERE "estado" = 'CANCELADA'
        AND "cancelled_at" IS NOT NULL
        AND "fecha" >= ${filters.from}
        AND "fecha" <= ${filters.to}
        AND ("fecha"::TIMESTAMP + "hora"::TIME - "cancelled_at") < INTERVAL '24 hours'
        AND ("fecha"::TIMESTAMP + "hora"::TIME) > "cancelled_at"
    `;
    const cancelacionesTardias = Number(cancelacionesTardiasRaw[0]?.total || 0);

    const kpis = {
      totalCitas,
      completadas,
      canceladas,
      noShow,
      pendientes,
      confirmadas,
      enProgreso,
      citasPasadas,
      clientesAtendidos,
      clientesNuevos,
      clientesRecurrentes: Math.max(clientesAtendidos - clientesNuevos, 0),
      promedioCitasDia,
      tasaAsistencia,
      tasaCancelacion,
      tasaNoShow,
      diaMasSolicitado,
      horaMasSolicitada,
      servicioMasSolicitado,
      empleadoTop,
      cancelacionesTardias,
      // Métricas financieras
      ingresosReales,
      ingresosProyectados,
      perdidasCancelacion,
      perdidasNoShow,
      ticketPromedio,
    };

    const deltas = filters.compare ? {
      totalCitas:       computeDelta(totalCitas,       totalPrev),
      completadas:      computeDelta(completadas,      completadasPrev),
      canceladas:       computeDelta(canceladas,       canceladasPrev),
      noShow:           computeDelta(noShow,           noShowPrev),
      tasaAsistencia:   computeDelta(tasaAsistencia,   tasaAsistenciaPrev),
      tasaCancelacion:  computeDelta(tasaCancelacion,  tasaCancelacionPrev),
      tasaNoShow:       computeDelta(tasaNoShow,       tasaNoShowPrev),
      // Deltas financieros
      ingresosReales:   computeDelta(ingresosReales,   ingresosRealesPrev),
      perdidasCancelacion: computeDelta(perdidasCancelacion, perdidasCancelacionPrev),
      perdidasNoShow:   computeDelta(perdidasNoShow,   perdidasNoShowPrev),
      ticketPromedio:   computeDelta(ticketPromedio,   ticketPromedioPrev),
    } : null;

    return NextResponse.json({
      kpis,
      deltas,
      meta: { from: filters.rawFrom, to: filters.rawTo, compare: filters.compare, timezone: 'America/Costa_Rica' },
    });
  } catch (err: any) {
    console.error('[/api/reportes/resumen]', err);
    return NextResponse.json({ error: 'Error interno al generar el resumen.' }, { status: 500 });
  }
}
