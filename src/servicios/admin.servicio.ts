import { prisma } from '../lib/db';
import { EstadoCita } from '@prisma/client';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, format } from 'date-fns';

export class AdminServicio {
  // ─── Dashboard completo ────────────────────────────────────────────────
  static async getDashboardStats(periodo: 'hoy' | 'semana' | 'mes' = 'mes') {
    const now = new Date();
    const hoy = startOfDay(now);
    const finHoy = endOfDay(now);
    const inicioMes = startOfMonth(now);
    const finMes = endOfMonth(now);

    // ── Conteos paralelos ───────────────────────────────────────────────
    const [
      totalCitas,
      citasCompletadas,
      citasHoy,
      citasPendientes,
      empleadosActivos,
      ingresosTotal,
      ingresosMes,
      ingresosHoy,
      upcomingAppointments,
      serviciosPopularesRaw,
      actividadReciente,
      citasHoyDetalle,
      productividadEmpleados,
    ] = await Promise.all([
      // Total citas
      prisma.cita.count(),
      // Completadas totales
      prisma.cita.count({ where: { estado: EstadoCita.COMPLETADA } }),
      // Citas hoy (todas)
      prisma.cita.count({ where: { fecha: { gte: hoy, lte: finHoy } } }),
      // Pendientes hoy
      prisma.cita.count({
        where: {
          estado: { in: [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA] },
          fecha: { gte: hoy },
        },
      }),
      // Empleados activos
      prisma.empleado.count({ where: { activo: true } }),
      // Ingresos totales (completadas)
      prisma.cita.aggregate({
        where: { estado: EstadoCita.COMPLETADA },
        _sum: { precio: true },
      }),
      // Ingresos este mes
      prisma.cita.aggregate({
        where: {
          estado: EstadoCita.COMPLETADA,
          fecha: { gte: inicioMes, lte: finMes },
        },
        _sum: { precio: true },
      }),
      // Ingresos hoy
      prisma.cita.aggregate({
        where: {
          estado: EstadoCita.COMPLETADA,
          fecha: { gte: hoy, lte: finHoy },
        },
        _sum: { precio: true },
      }),
      // Próximas citas (5)
      prisma.cita.findMany({
        where: {
          estado: { in: [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA, EstadoCita.REPROGRAMADA] },
          fecha: { gte: hoy },
        },
        orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
        take: 5,
        include: {
          empleado: { select: { nombre: true } },
          servicio: { select: { nombre: true, duracion: true } },
        },
      }),
      // Servicios populares con include (evita N+1)
      prisma.cita.groupBy({
        by: ['servicio_id'],
        _count: { servicio_id: true },
        orderBy: { _count: { servicio_id: 'desc' } },
        take: 5,
      }),
      // Actividad reciente (últimas 8 citas creadas)
      prisma.cita.findMany({
        orderBy: { created_at: 'desc' },
        take: 8,
        include: {
          empleado: { select: { nombre: true } },
          servicio: { select: { nombre: true } },
        },
      }),
      // Citas de hoy en detalle
      prisma.cita.findMany({
        where: { fecha: { gte: hoy, lte: finHoy } },
        orderBy: { hora: 'asc' },
        include: {
          empleado: { select: { nombre: true } },
          servicio: { select: { nombre: true, duracion: true } },
        },
      }),
      // Productividad por empleado (este mes)
      prisma.cita.groupBy({
        by: ['empleado_id'],
        where: { fecha: { gte: inicioMes, lte: finMes } },
        _count: { id: true },
        _sum: { precio: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    // ── Resolver nombres de servicios populares ───────────────────────
    const servicioIds = serviciosPopularesRaw.map((s) => s.servicio_id);
    const serviciosDetalle = await prisma.servicio.findMany({
      where: { id: { in: servicioIds } },
      select: { id: true, nombre: true },
    });
    const servicioMap = Object.fromEntries(serviciosDetalle.map((s) => [s.id, s.nombre]));
    const serviciosPopulares = serviciosPopularesRaw.map((s) => ({
      nombre: servicioMap[s.servicio_id] ?? 'Desconocido',
      cantidad: s._count.servicio_id,
    }));

    // ── Resolver nombres de empleados en productividad ────────────────
    const empIds = productividadEmpleados.map((e) => e.empleado_id);
    const empsDetalle = await prisma.empleado.findMany({
      where: { id: { in: empIds } },
      select: { id: true, nombre: true },
    });
    const empMap = Object.fromEntries(empsDetalle.map((e) => [e.id, e.nombre]));
    const productividad = productividadEmpleados.map((e) => ({
      nombre: empMap[e.empleado_id] ?? 'Empleado',
      citas: e._count.id,
      ingresos: e._sum.precio ?? 0,
    }));

    // ── Ingresos últimos 7 días (gráfica) ────────────────────────────
    const ingresosChart = await AdminServicio.getIngresosUltimos7Dias();

    // ── Tasa de completadas ───────────────────────────────────────────
    const tasaCompletadas = totalCitas > 0
      ? Math.round((citasCompletadas / totalCitas) * 100)
      : 0;

    return {
      stats: {
        totalCitas,
        citasCompletadas,
        citasHoy,
        citasPendientes,
        empleadosActivos,
        totalRevenue: ingresosTotal._sum.precio ?? 0,
        ingresosMes: ingresosMes._sum.precio ?? 0,
        ingresosHoy: ingresosHoy._sum.precio ?? 0,
        tasaCompletadas,
        // Legado
        totalAppointments: totalCitas,
        completedAppointments: citasCompletadas,
        totalRevenue_legacy: ingresosTotal._sum.precio ?? 0,
      },
      upcomingAppointments,
      citasHoy: citasHoyDetalle,
      serviciosPopulares,
      productividadEmpleados: productividad,
      actividadReciente: actividadReciente.map((c) => ({
        id: c.id,
        cliente_nombre: c.cliente_nombre,
        servicio: c.servicio.nombre,
        empleado: c.empleado.nombre,
        estado: c.estado,
        fecha: c.fecha,
        hora: c.hora,
        precio: c.precio,
        created_at: c.created_at,
      })),
      ingresosChart,
    };
  }

  // ─── Ingresos últimos 7 días ────────────────────────────────────────
  static async getIngresosUltimos7Dias() {
    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { inicio: startOfDay(d), fin: endOfDay(d), label: format(d, 'EEE', { locale: undefined }) };
    });

    const resultados = await Promise.all(
      dias.map(async ({ inicio, fin, label }) => {
        const agg = await prisma.cita.aggregate({
          where: {
            estado: EstadoCita.COMPLETADA,
            fecha: { gte: inicio, lte: fin },
          },
          _sum: { precio: true },
          _count: { id: true },
        });
        return {
          fecha: format(inicio, 'dd/MM'),
          dia: label,
          ingresos: agg._sum.precio ?? 0,
          citas: agg._count.id ?? 0,
        };
      })
    );

    return resultados;
  }
}
