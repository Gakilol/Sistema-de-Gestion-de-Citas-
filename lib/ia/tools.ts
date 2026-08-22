import { EstadoCita } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getScopedAppointmentWhere } from '@/lib/auth-helpers';
import { getBusinessTodayString, parseLocalDateToUTC } from '@/lib/timezone';
import { calculateAppointmentAvailability } from '@/lib/appointments/appointment-availability';
import { IAToolInputError, prepareCreateAppointment, prepareCreateClient, prepareUpdateAppointmentStatus } from './action-builders';
import type { IAExecutionContext, IAToolName, IAToolResult } from './types';

const emptySchema = z.object({}).optional().default({});
const searchSchema = z.object({ query: z.string().trim().min(2).max(80), limit: z.number().int().min(1).max(15).optional().default(8) });
const daysSchema = z.object({ dias: z.number().int().min(1).max(180).optional().default(30) });
const catalogSearchSchema = z.object({ query: z.string().trim().max(80).optional().default('') });
const slotsSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  servicio: z.string().trim().min(2).max(100),
  profesional: z.string().trim().max(100).optional(),
});

function scopedWhere(context: IAExecutionContext) {
  return getScopedAppointmentWhere(context.userId, context.userRole);
}

function dateRange(days: number) {
  const end = parseLocalDateToUTC(getBusinessTodayString());
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start, end };
}

async function getTodayAppointments(context: IAExecutionContext) {
  emptySchema.parse({});
  const today = parseLocalDateToUTC(getBusinessTodayString());
  return prisma.cita.findMany({
    where: { fecha: today, ...scopedWhere(context) },
    select: {
      id: true,
      cliente_nombre: true,
      hora: true,
      duracion: true,
      estado: true,
      servicio: { select: { nombre: true } },
      empleado: { select: { nombre: true } },
    },
    orderBy: { hora: 'asc' },
    take: 40,
  });
}

async function searchServices(args: unknown) {
  const { query } = catalogSearchSchema.parse(args);
  return prisma.servicio.findMany({
    where: { activo: true, ...(query ? { nombre: { contains: query, mode: 'insensitive' } } : {}) },
    select: { id: true, nombre: true, duracion: true, categoria: true },
    orderBy: { nombre: 'asc' },
    take: 12,
  });
}

async function getAvailableSlots(args: unknown, context: IAExecutionContext) {
  const data = slotsSchema.parse(args);
  const services = await prisma.servicio.findMany({
    where: { activo: true, nombre: { contains: data.servicio, mode: 'insensitive' } },
    select: { id: true, nombre: true, duracion: true },
    take: 3,
  });
  if (services.length !== 1) {
    throw new IAToolInputError(services.length === 0
      ? `No encontré el servicio “${data.servicio}”.`
      : `Indica uno de estos servicios: ${services.map((item: { nombre: string }) => item.nombre).join(', ')}.`);
  }
  const employees = await prisma.empleado.findMany({
    where: {
      activo: true,
      esAgendable: true,
      ...(context.userRole === 'EMPLEADO'
        ? { id: context.userId }
        : data.profesional ? { nombre: { contains: data.profesional, mode: 'insensitive' } } : {}),
    },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
    take: 8,
  });
  if (employees.length === 0) throw new IAToolInputError('No encontré profesionales disponibles con ese criterio.');

  return Promise.all(employees.map(async (employee: { id: string; nombre: string }) => {
    const availability = await calculateAppointmentAvailability(employee.id, data.fecha, services[0].id, services[0].duracion);
    return {
      profesional: employee.nombre,
      servicio: services[0].nombre,
      fecha: data.fecha,
      horas: (availability.bloques ?? []).filter((slot: { disponible: boolean }) => slot.disponible).slice(0, 12).map((slot: { hora: string }) => slot.hora),
    };
  }));
}

async function getAppointmentSummary(context: IAExecutionContext) {
  emptySchema.parse({});
  const today = parseLocalDateToUTC(getBusinessTodayString());
  const grouped = await prisma.cita.groupBy({
    by: ['estado'],
    where: { fecha: today, ...scopedWhere(context) },
    _count: { id: true },
  });
  const byStatus = Object.fromEntries(grouped.map((item: { estado: string; _count: { id: number } }) => [item.estado, item._count.id]));
  return {
    fecha: getBusinessTodayString(),
    total: grouped.reduce((sum: number, item: { _count: { id: number } }) => sum + item._count.id, 0),
    pendientes: (byStatus.PENDIENTE ?? 0) + (byStatus.CONFIRMADA ?? 0),
    enProgreso: byStatus.EN_PROGRESO ?? 0,
    completadas: byStatus.COMPLETADA ?? 0,
    canceladas: (byStatus.CANCELADA ?? 0) + (byStatus.NO_SHOW ?? 0),
  };
}

async function searchClients(args: unknown) {
  const { query, limit } = searchSchema.parse(args);
  return prisma.cliente.findMany({
    where: {
      OR: [
        { nombre: { contains: query, mode: 'insensitive' } },
        { telefono: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, nombre: true, telefono: true, correo: true, _count: { select: { citas: true } } },
    orderBy: { nombre: 'asc' },
    take: limit,
  });
}

async function getPopularServices(args: unknown, context: IAExecutionContext) {
  const { dias } = daysSchema.parse(args);
  const { start, end } = dateRange(dias);
  const grouped = await prisma.cita.groupBy({
    by: ['servicio_id'],
    where: {
      fecha: { gte: start, lte: end },
      estado: EstadoCita.COMPLETADA,
      ...scopedWhere(context),
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 8,
  });
  const services = await prisma.servicio.findMany({
    where: { id: { in: grouped.map((item: { servicio_id: string }) => item.servicio_id) } },
    select: { id: true, nombre: true },
  });
  const names = new Map(services.map((service: { id: string; nombre: string }) => [service.id, service.nombre]));
  return grouped.map((item: { servicio_id: string; _count: { id: number } }) => ({ servicio: names.get(item.servicio_id) ?? 'Servicio', citas: item._count.id }));
}

async function getStaffWorkload(args: unknown, context: IAExecutionContext) {
  const { dias } = daysSchema.parse(args);
  const { start, end } = dateRange(dias);
  const grouped = await prisma.cita.groupBy({
    by: ['empleado_id'],
    where: { fecha: { gte: start, lte: end }, ...scopedWhere(context) },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 12,
  });
  const employees = await prisma.empleado.findMany({
    where: { id: { in: grouped.map((item: { empleado_id: string }) => item.empleado_id) } },
    select: { id: true, nombre: true },
  });
  const names = new Map(employees.map((employee: { id: string; nombre: string }) => [employee.id, employee.nombre]));
  return grouped.map((item: { empleado_id: string; _count: { id: number } }) => ({ profesional: names.get(item.empleado_id) ?? 'Profesional', citas: item._count.id }));
}

export async function executeIATool(
  name: IAToolName,
  args: unknown,
  context: IAExecutionContext
): Promise<IAToolResult> {
  try {
    let data: unknown;
    let pendingAction;
    if (name === 'getTodayAppointments') data = await getTodayAppointments(context);
    else if (name === 'getAppointmentSummary') data = await getAppointmentSummary(context);
    else if (name === 'searchClients') data = await searchClients(args);
    else if (name === 'searchServices') data = await searchServices(args);
    else if (name === 'getAvailableSlots') data = await getAvailableSlots(args, context);
    else if (name === 'getPopularServices') data = await getPopularServices(args, context);
    else if (name === 'getStaffWorkload') data = await getStaffWorkload(args, context);
    else if (name === 'prepareCreateClient') pendingAction = await prepareCreateClient(args);
    else if (name === 'prepareCreateAppointment') pendingAction = await prepareCreateAppointment(args, context);
    else pendingAction = await prepareUpdateAppointmentStatus(args, context);
    if (pendingAction) data = { readyForConfirmation: true, summary: pendingAction.details };
    return { ok: true, data, meta: { fuenteDatos: 'HAIR STYLE' }, ...(pendingAction ? { pendingAction } : {}) };
  } catch (error) {
    if (error instanceof IAToolInputError) {
      return { ok: false, error: error.message, code: 'INVALID_PARAMS' };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, error: 'Los parámetros de la consulta no son válidos.', code: 'INVALID_PARAMS' };
    }
    console.error('[IA_TOOL_ERROR]', name, error);
    return { ok: false, error: 'No fue posible consultar los datos en este momento.', code: 'INTERNAL_ERROR' };
  }
}
