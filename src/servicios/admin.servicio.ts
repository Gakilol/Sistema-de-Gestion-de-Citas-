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
      ingresosHoyRaw,
      ingresosSemanaRaw,
      ingresosMesRaw,
      ingresosProyectadosRaw,
      ingresosRealesRaw,
      servicioMasGeneradorRaw,
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

      // Ingresos de Hoy
      prisma.cita.aggregate({
        where: { estado: EstadoCita.COMPLETADA, fecha: { gte: dateToday, lte: dateToday }, ...filterCita },
        _sum: { monto: true }
      }),
      // Ingresos de la Semana
      prisma.cita.aggregate({
        where: { estado: EstadoCita.COMPLETADA, fecha: { gte: inicioSemana, lte: finSemana }, ...filterCita },
        _sum: { monto: true }
      }),
      // Ingresos del Mes
      prisma.cita.aggregate({
        where: { estado: EstadoCita.COMPLETADA, fecha: { gte: inicioMes, lte: finMes }, ...filterCita },
        _sum: { monto: true }
      }),
      // Ingresos Proyectados
      prisma.cita.aggregate({
        where: { estado: { in: [EstadoCita.PENDIENTE, EstadoCita.CONFIRMADA, EstadoCita.EN_PROGRESO, EstadoCita.REPROGRAMADA] }, ...filterCita },
        _sum: { monto: true }
      }),
      // Ingresos Reales Totales
      prisma.cita.aggregate({
        where: { estado: EstadoCita.COMPLETADA, ...filterCita },
        _sum: { monto: true }
      }),
      // Servicio que más dinero genera (Top 1)
      prisma.citaServicio.groupBy({
        by: ['servicio_id'],
        where: { cita: { estado: EstadoCita.COMPLETADA, ...filterCita } },
        _sum: { precio: true },
        orderBy: { _sum: { precio: 'desc' } },
        take: 1
      }),
      // Citas canceladas totales (para empleado)
      prisma.cita.count({
        where: { estado: EstadoCita.CANCELADA, ...filterCita }
      }),
    ]);

    // Resolver nombre del servicio que más genera
    let servicioMasGeneradorNombre = 'N/A';
    if (servicioMasGeneradorRaw.length > 0) {
      const s = await prisma.servicio.findUnique({
        where: { id: servicioMasGeneradorRaw[0].servicio_id },
        select: { nombre: true }
      });
      servicioMasGeneradorNombre = s?.nombre || 'N/A';
    }

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
        ingresosHoy: ingresosHoyRaw._sum.monto ? Number(ingresosHoyRaw._sum.monto) : 0,
        ingresosSemana: ingresosSemanaRaw._sum.monto ? Number(ingresosSemanaRaw._sum.monto) : 0,
        ingresosMes: ingresosMesRaw._sum.monto ? Number(ingresosMesRaw._sum.monto) : 0,
        ingresosProyectados: ingresosProyectadosRaw._sum.monto ? Number(ingresosProyectadosRaw._sum.monto) : 0,
        ingresosReales: ingresosRealesRaw._sum.monto ? Number(ingresosRealesRaw._sum.monto) : 0,
        servicioMasGenerador: servicioMasGeneradorNombre,
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
