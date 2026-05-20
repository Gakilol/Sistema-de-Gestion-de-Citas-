import { prisma } from '@/lib/db';
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
      citasCompletadasMes,
      citasCompletadasHoy,
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
      // Completadas este mes
      prisma.cita.count({
        where: {
          estado: EstadoCita.COMPLETADA,
          fecha: { gte: inicioMes, lte: finMes },
        },
      }),
      // Completadas hoy
      prisma.cita.count({
        where: {
          estado: EstadoCita.COMPLETADA,
          fecha: { gte: hoy, lte: finHoy },
        },
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
    }));

    // ── Citas últimos 7 días (gráfica) ────────────────────────────
    const citasChart = await AdminServicio.getCitasUltimos7Dias();

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
        citasCompletadasMes,
        citasCompletadasHoy,
        tasaCompletadas,
        // Legado
        totalAppointments: totalCitas,
        completedAppointments: citasCompletadas,
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
        created_at: c.created_at,
      })),
      citasChart,
    };
  }

  // ─── Citas últimos 7 días ────────────────────────────────────────
  static async getCitasUltimos7Dias() {
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
          _count: { id: true },
        });
        return {
          fecha: format(inicio, 'dd/MM'),
          dia: label,
          citas: agg._count.id ?? 0,
        };
      })
    );

    return resultados;
  }
}
