import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireReporteRole, parseReportFilters } from '@/lib/reportes-utils';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export async function GET(req: NextRequest) {
  const authError = requireReporteRole(req);
  if (authError) return authError;

  const parsed = parseReportFilters(req);
  if ('error' in parsed) return parsed.error;
  const { filters } = parsed;

  try {
    const baseWhere = {
      fecha: { gte: filters.from, lte: filters.to },
      ...(filters.empleadoId ? { empleado_id: filters.empleadoId } : {}),
      ...(filters.servicioId  ? { servicio_id: filters.servicioId  } : {}),
    };

    // Build conditional SQL filters
    const empFilter  = filters.empleadoId ? Prisma.sql`AND "empleado_id" = ${filters.empleadoId}` : Prisma.empty;
    const servFilter = filters.servicioId  ? Prisma.sql`AND "servicio_id" = ${filters.servicioId}` : Prisma.empty;

    // Appointments by day of week
    const porDiaSemanaRaw: any[] = await prisma.$queryRaw`
      SELECT
        EXTRACT(DOW FROM "fecha")::INT AS dow,
        COUNT(*) AS total
      FROM "Cita"
      WHERE "fecha" >= ${filters.from}
        AND "fecha" <= ${filters.to}
        ${empFilter} ${servFilter}
      GROUP BY dow
      ORDER BY dow
    `;
    const porDiaSemana = DIAS_SEMANA.map((dia, i) => {
      const found = porDiaSemanaRaw.find(r => Number(r.dow) === i);
      return { dia, total: found ? Number(found.total) : 0 };
    });
    const maxDia = porDiaSemana.reduce((a, b) => (b.total > a.total ? b : a), porDiaSemana[0]);
    const minDia = porDiaSemana.reduce((a, b) => (b.total < a.total ? b : a), porDiaSemana[0]);

    // Appointments by hour
    const porHoraRaw: any[] = await prisma.$queryRaw`
      SELECT
        SUBSTRING("hora" FROM 1 FOR 2)::INT AS hora,
        COUNT(*) AS total
      FROM "Cita"
      WHERE "fecha" >= ${filters.from}
        AND "fecha" <= ${filters.to}
        ${empFilter} ${servFilter}
      GROUP BY hora
      ORDER BY hora
    `;
    const porHora = Array.from({ length: 24 }, (_, h) => {
      const found = porHoraRaw.find(r => Number(r.hora) === h);
      return {
        hora: `${String(h).padStart(2, '0')}:00`,
        label: `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`,
        total: found ? Number(found.total) : 0,
      };
    }).filter(h => h.total > 0 || (h.hora >= '06:00' && h.hora <= '22:00'));

    // Heatmap: day of week × hour
    const heatmapRaw: any[] = await prisma.$queryRaw`
      SELECT
        EXTRACT(DOW FROM "fecha")::INT AS dow,
        SUBSTRING("hora" FROM 1 FOR 2)::INT AS hora,
        COUNT(*) AS total
      FROM "Cita"
      WHERE "fecha" >= ${filters.from}
        AND "fecha" <= ${filters.to}
        ${empFilter} ${servFilter}
      GROUP BY dow, hora
    `;
    const heatmap = heatmapRaw.map(r => ({
      dia: DIAS_SEMANA[Number(r.dow)] || `Día ${r.dow}`,
      hora: `${String(Number(r.hora)).padStart(2, '0')}:00`,
      total: Number(r.total),
    }));

    // Services most requested
    const porServicioRaw = await prisma.cita.groupBy({
      by: ['servicio_id'],
      where: baseWhere,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const servicioIds = porServicioRaw.map(r => r.servicio_id);
    const servicios = await prisma.servicio.findMany({ where: { id: { in: servicioIds } }, select: { id: true, nombre: true } });
    const servicioMap = Object.fromEntries(servicios.map(s => [s.id, s.nombre]));
    const porServicio = porServicioRaw.map(r => ({ nombre: servicioMap[r.servicio_id] || '—', total: r._count.id }));

    // Total for percentages
    const total = porServicio.reduce((s, r) => s + r.total, 0);

    return NextResponse.json({
      porDiaSemana,
      porHora,
      heatmap,
      porServicio: porServicio.map(r => ({ ...r, pct: total > 0 ? Math.round((r.total / total) * 1000) / 10 : 0 })),
      insights: {
        diaMasSolicitado: maxDia,
        diaMenosSolicitado: minDia,
      },
      meta: { from: filters.rawFrom, to: filters.rawTo, timezone: 'America/Costa_Rica' },
    });
  } catch (err: any) {
    console.error('[/api/reportes/demanda]', err);
    return NextResponse.json({ error: 'Error interno al generar el reporte de demanda.' }, { status: 500 });
  }
}
