import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireReporteRole, parseReportFilters } from '@/lib/reportes-utils';

export async function GET(req: NextRequest) {
  const authError = requireReporteRole(req);
  if (authError) return authError;

  const parsed = parseReportFilters(req);
  if ('error' in parsed) return parsed.error;
  const { filters } = parsed;

  const sp = req.nextUrl.searchParams;
  // Inactivity threshold in days
  const diasInactividad = Math.min(Math.max(parseInt(sp.get('dias') || '90'), 1), 730);

  // Pagination
  const page     = Math.max(parseInt(sp.get('page')  || '1'),  1);
  const pageSize = Math.min(Math.max(parseInt(sp.get('size')  || '25'), 5), 100);
  const skip     = (page - 1) * pageSize;

  try {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - diasInactividad * 86400000);

    // Find clients who had at least one completed appointment before cutoff
    // AND don't have any future confirmed/pending/scheduled appointments
    // AND have no completed appointment after cutoff
    const clientesInactivosRaw: any[] = await prisma.$queryRaw`
      SELECT
        c."id",
        c."nombre",
        c."telefono",
        MAX(ci."fecha") AS ultima_cita,
        COUNT(ci."id")::INT AS total_citas,
        COUNT(ci."id") FILTER (WHERE ci."estado" = 'COMPLETADA')::INT AS completadas,
        COUNT(ci."id") FILTER (WHERE ci."estado" = 'CANCELADA')::INT AS canceladas,
        COUNT(ci."id") FILTER (WHERE ci."estado" = 'NO_SHOW')::INT AS no_shows,
        EXTRACT(DAY FROM NOW() - MAX(ci."fecha"))::INT AS dias_desde_ultima
      FROM "Cliente" c
      INNER JOIN "Cita" ci ON ci."cliente_id" = c."id"
      WHERE ci."estado" = 'COMPLETADA'
      GROUP BY c."id", c."nombre", c."telefono"
      HAVING
        -- Last completed appointment is before cutoff date
        MAX(ci."fecha") < ${cutoffDate}
        -- No future bookings
        AND NOT EXISTS (
          SELECT 1 FROM "Cita" fc
          WHERE fc."cliente_id" = c."id"
            AND fc."fecha" > ${now}
            AND fc."estado" IN ('PENDIENTE', 'CONFIRMADA', 'REPROGRAMADA')
        )
      ORDER BY MAX(ci."fecha") ASC
    `;

    const total = clientesInactivosRaw.length;

    // Paginate
    const paginated = clientesInactivosRaw.slice(skip, skip + pageSize);

    // Enrich with most used service per client
    const clienteIds = paginated.map((r: any) => r.id);
    let servicioFavMap: Record<string, string> = {};
    let empleadoFavMap: Record<string, string> = {};

    if (clienteIds.length > 0) {
      const servicioFavRaw = await prisma.cita.groupBy({
        by: ['cliente_id', 'servicio_id'],
        where: { cliente_id: { in: clienteIds }, estado: 'COMPLETADA' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });
      // Take top 1 per client
      const seenClientes = new Set<string>();
      for (const row of servicioFavRaw) {
        if (!row.cliente_id || seenClientes.has(row.cliente_id)) continue;
        seenClientes.add(row.cliente_id);
        const s = await prisma.servicio.findUnique({ where: { id: row.servicio_id }, select: { nombre: true } });
        if (s) servicioFavMap[row.cliente_id] = s.nombre;
      }

      const empleadoFavRaw = await prisma.cita.groupBy({
        by: ['cliente_id', 'empleado_id'],
        where: { cliente_id: { in: clienteIds }, estado: 'COMPLETADA' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });
      const seenClientesEmp = new Set<string>();
      for (const row of empleadoFavRaw) {
        if (!row.cliente_id || seenClientesEmp.has(row.cliente_id)) continue;
        seenClientesEmp.add(row.cliente_id);
        const e = await prisma.empleado.findUnique({ where: { id: row.empleado_id }, select: { nombre: true } });
        if (e) empleadoFavMap[row.cliente_id] = e.nombre;
      }
    }

    const clientes = paginated.map((r: any) => ({
      id:             r.id,
      nombre:         r.nombre,
      telefono:       r.telefono || null,
      ultimaCita:     r.ultima_cita,
      diasSinVisita:  Number(r.dias_desde_ultima),
      totalCitas:     Number(r.total_citas),
      completadas:    Number(r.completadas),
      canceladas:     Number(r.canceladas),
      noShows:        Number(r.no_shows),
      servicioFavorito: servicioFavMap[r.id] || '—',
      empleadoFrecuente: empleadoFavMap[r.id] || '—',
      estadoInactividad: Number(r.dias_desde_ultima) > diasInactividad * 2
        ? 'muy_inactivo'
        : 'inactivo',
    }));

    return NextResponse.json({
      clientes,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      meta: {
        diasInactividad,
        corteFecha: cutoffDate.toISOString().split('T')[0],
        timezone: 'America/Costa_Rica',
      },
    });
  } catch (err: any) {
    console.error('[/api/reportes/clientes-inactivos]', err);
    return NextResponse.json({ error: 'Error interno al generar el reporte de clientes inactivos.' }, { status: 500 });
  }
}
