import { EstadoCita } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getScopedAppointmentWhere } from '@/lib/auth-helpers';
import { getBusinessTodayString, parseLocalDateToUTC } from '@/lib/timezone';
import { calculateAppointmentAvailability } from '@/lib/appointments/appointment-availability';
import { searchClientDirectory } from '@/lib/clients/client-search';
import { resolveServiceDirectory, searchEmployeeDirectory, searchServiceDirectory } from '@/lib/catalog/catalog-search';
import { buildClientDirectoryResponse } from '@/lib/client-privacy';
import {
  IAToolInputError, prepareAddClientPreference, prepareAddWaitlist, prepareCreateAppointment,
  prepareCreateClient, prepareUpdateAppointmentStatus, prepareUpdateAppointmentStatusByQuery,
  prepareWhatsAppReminder,
} from './action-builders';
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
  return searchServiceDirectory(query, { limit: 12 });
}

async function getAvailableSlots(args: unknown, context: IAExecutionContext) {
  const data = slotsSchema.parse(args);
  const serviceResult = await resolveServiceDirectory(data.servicio, { limit: 8 });
  if (serviceResult.kind !== 'found') {
    throw new IAToolInputError(serviceResult.kind === 'not_found'
      ? `No encontré el servicio “${data.servicio}”.`
      : `Indica uno de estos servicios: ${serviceResult.items.map((item) => item.nombre).join(', ')}.`);
  }
  const service = serviceResult.item;
  const employees = context.userRole === 'EMPLEADO'
    ? await prisma.empleado.findMany({
        where: { id: context.userId, activo: true, esAgendable: true },
        select: { id: true, nombre: true },
        take: 1,
      })
    : await searchEmployeeDirectory(data.profesional ?? '', { limit: 8 });
  if (employees.length === 0) throw new IAToolInputError('No encontré profesionales disponibles con ese criterio.');

  return Promise.all(employees.map(async (employee: { id: string; nombre: string }) => {
    const availability = await calculateAppointmentAvailability(employee.id, data.fecha, service.id, service.duracion);
    return {
      profesional: employee.nombre,
      servicio: service.nombre,
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

async function searchClients(args: unknown, context: IAExecutionContext) {
  const { query, limit } = searchSchema.parse(args);
  const clients = await searchClientDirectory(query, { limit });
  return clients.map((client) => buildClientDirectoryResponse(client, context.userRole));
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
    else if (name === 'searchClients') data = await searchClients(args, context);
    else if (name === 'searchServices') data = await searchServices(args);
    else if (name === 'getAvailableSlots') data = await getAvailableSlots(args, context);
    else if (name === 'getPopularServices') data = await getPopularServices(args, context);
    else if (name === 'getStaffWorkload') data = await getStaffWorkload(args, context);
    else if (name === 'prepareCreateClient') pendingAction = await prepareCreateClient(args, context);
    else if (name === 'prepareCreateAppointment') pendingAction = await prepareCreateAppointment(args, context);
    else if (name === 'prepareUpdateAppointmentStatus') pendingAction = await prepareUpdateAppointmentStatus(args, context);
    else if (name === 'prepareUpdateAppointmentStatusByQuery') pendingAction = await prepareUpdateAppointmentStatusByQuery(args, context);
    else if (name === 'prepareAddWaitlist') pendingAction = await prepareAddWaitlist(args, context);
    else if (name === 'prepareAddClientPreference') pendingAction = await prepareAddClientPreference(args, context);
    else pendingAction = await prepareWhatsAppReminder(args, context);
    if (pendingAction) data = { readyForConfirmation: true, summary: pendingAction.details };
    return { ok: true, data, meta: { fuenteDatos: 'HAIR STYLE' }, ...(pendingAction ? { pendingAction } : {}) };
  } catch (error) {
    if (error instanceof IAToolInputError) {
      return { ok: false, error: error.message, code: 'INVALID_PARAMS', ...(error.choiceRequest ? { choiceRequest: error.choiceRequest } : {}) };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, error: 'Los parámetros de la consulta no son válidos.', code: 'INVALID_PARAMS' };
    }
    console.error('[IA_TOOL_ERROR]', name, error);
    return { ok: false, error: 'No fue posible consultar los datos en este momento.', code: 'INTERNAL_ERROR' };
  }
}
