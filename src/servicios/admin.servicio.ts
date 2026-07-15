import { prisma } from '@/lib/db';
import { EstadoCita } from '@prisma/client';
import { getBusinessTodayString, parseLocalDateToUTC } from '@/lib/timezone';
import { syncCitaEstados } from '@/lib/automatizacion';

export class AdminServicio {
  // ─── Dashboard completo con soporte opcional de empleadoId ─────────────
  static async getDashboardStats(periodo: 'hoy' | 'semana' | 'mes' = 'mes', empleadoId?: string) {
    // Sincronizar estados de citas de forma automática y JIT antes de computar métricas
    await syncCitaEstados();

    const todayStr = getBusinessTodayString();
    const dateToday = parseLocalDateToUTC(todayStr);

    const [year, month] = todayStr.split('-').map(Number);
    const inicioMes = new Date(Date.UTC(year, month - 1, 1));
    const lastDay = new Date(year, month, 0).getDate();
    const finMes = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));

    // Calcular inicio y fin de la semana actual
    const dayOfWeek = dateToday.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const inicioSemana = new Date(dateToday);
    inicioSemana.setUTCDate(dateToday.getUTCDate() - diffToMonday);
    const finSemana = new Date(inicioSemana);
    finSemana.setUTCDate(inicioSemana.getUTCDate() + 6);
    finSemana.setUTCHours(23, 59, 59, 999);

    // Filtro base por empleado
    const filterCita = empleadoId ? { empleado_id: empleadoId } : {};

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
      citasCanceladasTotales, // Nueva métrica para empleado
    ] = await Promise.all([
      // Total citas
      prisma.cita.count({ where: filterCita }),
      // Completadas totales
      prisma.cita.count({ where: { estado: EstadoCita.COMPLETADA, ...filterCita } }),
      // Citas hoy (todas)
      prisma.cita.count({
        where: {
          fecha: {
            gte: dateToday,
            lte: dateToday,
          },
          ...filterCita,
        },
      }),
      // Pendientes hoy
      prisma.cita.count({
        where: {
          estado: { in: [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA] },
          fecha: {
            gte: dateToday,
            lte: dateToday,
          },
          ...filterCita,
        },
      }),
      // Empleados activos (si es empleado, sólo cuenta 1 o si está activo)
      empleadoId
        ? prisma.empleado.count({ where: { id: empleadoId, activo: true } })
        : prisma.empleado.count({ where: { activo: true } }),
      // Completadas este mes
      prisma.cita.count({
        where: {
          estado: EstadoCita.COMPLETADA,
          fecha: { gte: inicioMes, lte: finMes },
          ...filterCita,
        },
      }),
      // Completadas hoy
      prisma.cita.count({
        where: {
          estado: EstadoCita.COMPLETADA,
          fecha: {
            gte: dateToday,
            lte: dateToday,
          },
          ...filterCita,
        },
      }),

      // Próximas citas (5)
      prisma.cita.findMany({
        where: {
          estado: { in: [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA, EstadoCita.REPROGRAMADA] },
          fecha: { gte: dateToday },
          ...filterCita,
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
        where: filterCita,
        _count: { servicio_id: true },
        orderBy: { _count: { servicio_id: 'desc' } },
        take: 5,
      }),
      // Actividad reciente (últimas 8 citas creadas)
      prisma.cita.findMany({
        where: filterCita,
        orderBy: { created_at: 'desc' },
        take: 8,
        include: {
          empleado: { select: { nombre: true } },
          servicio: { select: { nombre: true } },
        },
      }),
      // Citas de hoy en detalle
      prisma.cita.findMany({
        where: {
          fecha: {
            gte: dateToday,
            lte: dateToday,
          },
          ...filterCita,
        },
        orderBy: { hora: 'asc' },
        include: {
          empleado: { select: { nombre: true } },
          servicio: { select: { nombre: true, duracion: true } },
        },
      }),

      // Productividad por empleado (este mes) - Si es empleado individual no es tan útil, pero se puede agrupar igual
      prisma.cita.groupBy({
        by: ['empleado_id'],
        where: { fecha: { gte: inicioMes, lte: finMes }, ...filterCita },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      // Citas canceladas totales (para empleado)
      prisma.cita.count({
        where: { estado: EstadoCita.CANCELADA, ...filterCita }
      }),
    ]);



    // ── Resolver nombres de servicios populares ───────────────────────
    const servicioIds = serviciosPopularesRaw.map((s: any) => s.servicio_id);
    const serviciosDetalle = await prisma.servicio.findMany({
      where: { id: { in: servicioIds } },
      select: { id: true, nombre: true },
    });
    const servicioMap = Object.fromEntries(serviciosDetalle.map((s: any) => [s.id, s.nombre]));
    const serviciosPopulares = serviciosPopularesRaw.map((s: any) => ({
      nombre: servicioMap[s.servicio_id] ?? 'Desconocido',
      cantidad: s._count.servicio_id,
    }));

    // ── Resolver nombres de empleados en productividad ────────────────
    const empIds = productividadEmpleados.map((e: any) => e.empleado_id);
    const empsDetalle = await prisma.empleado.findMany({
      where: { id: { in: empIds } },
      select: { id: true, nombre: true },
    });
    const empMap = Object.fromEntries(empsDetalle.map((e: any) => [e.id, e.nombre]));
    const productividad = productividadEmpleados.map((e: any) => ({
      nombre: empMap[e.empleado_id] ?? 'Empleado',
      citas: e._count.id,
    }));

    // ── Citas últimos 7 días (gráfica) ────────────────────────────
    const citasChart = await AdminServicio.getCitasUltimos7Dias(empleadoId);

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
        citasCanceladasTotales,
        // Legado
        totalAppointments: totalCitas,
        completedAppointments: citasCompletadas,
      },
      upcomingAppointments,
      citasHoy: citasHoyDetalle,
      serviciosPopulares,
      productividadEmpleados: productividad,
      actividadReciente: actividadReciente.map((c: any) => ({
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
  static async getCitasUltimos7Dias(empleadoId?: string) {
    const todayStr = getBusinessTodayString();
    const [year, month, day] = todayStr.split('-').map(Number);
    const baseDate = new Date(Date.UTC(year, month - 1, day));

    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() - (6 - i));
      return d;
    });

    const resultados = await Promise.all(
      dias.map(async (d) => {
        const agg = await prisma.cita.aggregate({
          where: {
            estado: EstadoCita.COMPLETADA,
            fecha: d,
            ...(empleadoId ? { empleado_id: empleadoId } : {}),
          },
          _count: { id: true },
        });

        const dayLabel = d.toLocaleDateString('es-CR', { weekday: 'short', timeZone: 'UTC' }).slice(0, 3);
        const dateLabel = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

        return {
          fecha: dateLabel,
          dia: dayLabel,
          citas: agg._count.id ?? 0,
        };
      })
    );

    return resultados;
  }
}
