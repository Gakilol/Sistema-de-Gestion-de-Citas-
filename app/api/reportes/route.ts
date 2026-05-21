import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { EstadoCita } from '@prisma/client';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { syncCitaEstados } from '@/lib/automatizacion';

export async function GET(req: NextRequest) {
  try {
    // Sincronizar estados de citas de forma JIT para reportes precisos
    await syncCitaEstados();

    const tipo  = req.nextUrl.searchParams.get('tipo') ?? 'citas';
    const desde = req.nextUrl.searchParams.get('desde');
    const hasta = req.nextUrl.searchParams.get('hasta');

    const fechaDesde = desde ? startOfDay(new Date(desde)) : startOfMonth(subMonths(new Date(), 2));
    const fechaHasta = hasta ? endOfDay(new Date(hasta))   : endOfDay(new Date());

    // ── Citas por estado ─────────────────────────────────────────────
    if (tipo === 'citas') {
      const [byEstado, byEmpleado, byServicio] = await Promise.all([
        prisma.cita.groupBy({
          by: ['estado'],
          where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
          _count: { id: true },
        }),
        prisma.cita.groupBy({
          by: ['empleado_id'],
          where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
        prisma.cita.groupBy({
          by: ['servicio_id'],
          where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 8,
        }),
      ]);

      // Resolver nombres
      const empIds  = byEmpleado.map(e => e.empleado_id);
      const servIds = byServicio.map(s => s.servicio_id);
      const [emps, servs] = await Promise.all([
        prisma.empleado.findMany({ where: { id: { in: empIds } }, select: { id: true, nombre: true } }),
        prisma.servicio.findMany({ where: { id: { in: servIds } }, select: { id: true, nombre: true } }),
      ]);
      const empMap  = Object.fromEntries(emps.map(e  => [e.id, e.nombre]));
      const servMap = Object.fromEntries(servs.map(s => [s.id, s.nombre]));

      return NextResponse.json({
        porEstado:   byEstado.map(e  => ({ estado: e.estado,   cantidad: e._count.id })),
        porEmpleado: byEmpleado.map(e => ({ nombre: empMap[e.empleado_id]??'—', citas: e._count.id })),
        porServicio: byServicio.map(s => ({ nombre: servMap[s.servicio_id]??'—', cantidad: s._count.id })),
      });
    }

    // ── Productividad empleados ──────────────────────────────────────
    if (tipo === 'empleados') {
      const data = await prisma.cita.groupBy({
        by: ['empleado_id'],
        where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });
      const ids  = data.map(d => d.empleado_id);
      const emps = await prisma.empleado.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, especialidad: true } });
      const empMap = Object.fromEntries(emps.map(e => [e.id, e]));
      return NextResponse.json({
        data: data.map(d => ({
          nombre:      empMap[d.empleado_id]?.nombre ?? '—',
          especialidad:empMap[d.empleado_id]?.especialidad ?? '—',
          citas:       d._count.id,
        })),
      });
    }

    return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
