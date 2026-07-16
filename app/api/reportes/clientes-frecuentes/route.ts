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
    const where = {
      fecha:  { gte: filters.from, lte: filters.to },
      estado: 'COMPLETADA' as const,
      cliente_id: { not: null as any },
    };

    // Top clients by completed appointments
    const topClientesRaw = await prisma.cita.groupBy({
      by: ['cliente_id', 'cliente_nombre'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    const topClientes = topClientesRaw.map((r: any, i: number) => ({
      rank:      i + 1,
      nombre:    r.cliente_nombre,
      clienteId: r.cliente_id,
      visitas:   r._count.id,
    }));

    // Total unique clients served (completadas)
    const totalClientesAtendidos = await prisma.cita.findMany({
      where,
      select: { cliente_id: true },
      distinct: ['cliente_id'],
    }).then((rows: any[]) => rows.length);

    // New clients in period (first appointment ever is within period)
    const clientesNuevosRaw: any[] = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT c."id") AS total
      FROM "Cliente" c
      WHERE c."createdAt" >= ${filters.from}
        AND c."createdAt" <= ${filters.to}
        AND EXISTS (
          SELECT 1 FROM "Cita" ci
          WHERE ci."cliente_id" = c."id"
            AND ci."estado" = 'COMPLETADA'
            AND ci."fecha" >= ${filters.from}
            AND ci."fecha" <= ${filters.to}
        )
    `;
    const clientesNuevos = Number(clientesNuevosRaw[0]?.total || 0);
    const clientesRecurrentes = Math.max(totalClientesAtendidos - clientesNuevos, 0);
    const tasaRecurrentes = safeRate(clientesRecurrentes, totalClientesAtendidos);

    // Average time between visits (for clients with >= 2 completed visits)
    const promedioDiasRaw: any[] = await prisma.$queryRaw`
      WITH visitas AS (
        SELECT
          "cliente_id",
          "fecha",
          LAG("fecha") OVER (PARTITION BY "cliente_id" ORDER BY "fecha") AS prev_fecha
        FROM "Cita"
        WHERE "estado" = 'COMPLETADA'
          AND "cliente_id" IS NOT NULL
      ),
      intervalos AS (
        SELECT
          "cliente_id",
          ("fecha" - "prev_fecha")::FLOAT AS dias
        FROM visitas
        WHERE "prev_fecha" IS NOT NULL AND "fecha" > "prev_fecha"
      )
      SELECT
        ROUND(AVG("dias")::NUMERIC, 1) AS promedio,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "dias") AS mediana
      FROM intervalos
    `;
    const promedioDiasEntreVisitas = Number(promedioDiasRaw[0]?.promedio || 0);
    const medianaDiasEntreVisitas  = Number(promedioDiasRaw[0]?.mediana  || 0);

    // Frequency distribution
    const distribucionFrecuenciaRaw: any[] = await prisma.$queryRaw`
      WITH visitas AS (
        SELECT
          "cliente_id",
          "fecha",
          LAG("fecha") OVER (PARTITION BY "cliente_id" ORDER BY "fecha") AS prev_fecha
        FROM "Cita"
        WHERE "estado" = 'COMPLETADA'
          AND "cliente_id" IS NOT NULL
      ),
      intervalos AS (
        SELECT
          "cliente_id",
          AVG("fecha" - "prev_fecha") AS avg_dias
        FROM visitas
        WHERE "prev_fecha" IS NOT NULL AND "fecha" > "prev_fecha"
        GROUP BY "cliente_id"
      )
      SELECT
        COUNT(*) FILTER (WHERE avg_dias < 30)  AS frecuente,
        COUNT(*) FILTER (WHERE avg_dias BETWEEN 30 AND 90) AS regular,
        COUNT(*) FILTER (WHERE avg_dias > 90)  AS en_riesgo
      FROM intervalos
    `;
    const distribucionFrecuencia = {
      frecuente:  Number(distribucionFrecuenciaRaw[0]?.frecuente  || 0),
      regular:    Number(distribucionFrecuenciaRaw[0]?.regular    || 0),
      enRiesgo:   Number(distribucionFrecuenciaRaw[0]?.en_riesgo  || 0),
    };

    // Return rate: clients who came back within 30/60/90 days
    const retornoRaw: any[] = await prisma.$queryRaw`
      WITH visitas AS (
        SELECT
          "cliente_id",
          "fecha",
          LEAD("fecha") OVER (PARTITION BY "cliente_id" ORDER BY "fecha") AS next_fecha
        FROM "Cita"
        WHERE "estado" = 'COMPLETADA'
          AND "cliente_id" IS NOT NULL
          AND "fecha" >= ${filters.from}
          AND "fecha" <= ${filters.to}
      )
      SELECT
        COUNT(DISTINCT "cliente_id") FILTER (WHERE (next_fecha - "fecha") <= 30) AS retorno_30,
        COUNT(DISTINCT "cliente_id") FILTER (WHERE (next_fecha - "fecha") <= 60) AS retorno_60,
        COUNT(DISTINCT "cliente_id") FILTER (WHERE (next_fecha - "fecha") <= 90) AS retorno_90
      FROM visitas
      WHERE next_fecha IS NOT NULL
    `;
    const tasaRetorno = {
      dias30: Number(retornoRaw[0]?.retorno_30 || 0),
      dias60: Number(retornoRaw[0]?.retorno_60 || 0),
      dias90: Number(retornoRaw[0]?.retorno_90 || 0),
    };

    return NextResponse.json({
      resumen: {
        totalClientesAtendidos,
        clientesNuevos,
        clientesRecurrentes,
        tasaRecurrentes,
        promedioDiasEntreVisitas,
        medianaDiasEntreVisitas,
      },
      distribucionFrecuencia,
      tasaRetorno,
      topClientes,
      meta: { from: filters.rawFrom, to: filters.rawTo, timezone: 'America/Costa_Rica' },
    });
  } catch (err: any) {
    console.error('[/api/reportes/clientes-frecuentes]', err);
    return NextResponse.json({ error: 'Error interno al generar el reporte de clientes frecuentes.' }, { status: 500 });
  }
}
