import { EstadoCita } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { calculateAppointmentAvailability } from '@/lib/appointments/appointment-availability';
import { getBusinessTodayString } from '@/lib/timezone';
import type { IAExecutionContext, IAPendingAction } from './types';

export class IAToolInputError extends Error {}

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

const createClientSchema = z.object({
  nombre: z.string().trim().min(2).max(150),
  telefono: optionalText(30),
  email: z.string().trim().email().max(254).optional().nullable(),
  notas: optionalText(500),
});

const createAppointmentSchema = z.object({
  cliente: z.string().trim().min(2).max(150),
  telefono: optionalText(30),
  servicio: z.string().trim().min(2).max(100),
  profesional: optionalText(100),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  notas: optionalText(500),
});

const updateStatusSchema = z.object({
  citaId: z.string().uuid(),
  estado: z.nativeEnum(EstadoCita),
  motivo: optionalText(300),
});

function clean(value: string | null | undefined) {
  return value?.trim() || undefined;
}

async function resolveService(query: string) {
  const services = await prisma.servicio.findMany({
    where: { activo: true, nombre: { contains: query, mode: 'insensitive' } },
    select: { id: true, nombre: true, duracion: true },
    orderBy: { nombre: 'asc' },
    take: 6,
  });
  const exact = services.find((service: { nombre: string }) => service.nombre.localeCompare(query, 'es', { sensitivity: 'base' }) === 0);
  if (exact) return exact;
  if (services.length === 1) return services[0];
  if (services.length === 0) throw new IAToolInputError(`No encontré un servicio activo llamado “${query}”.`);
  throw new IAToolInputError(`Encontré varios servicios: ${services.map((service: { nombre: string }) => service.nombre).join(', ')}. Indica uno exactamente.`);
}

async function resolveEmployee(query: string | undefined, context: IAExecutionContext) {
  if (context.userRole === 'EMPLEADO') {
    const own = await prisma.empleado.findUnique({ where: { id: context.userId }, select: { id: true, nombre: true, activo: true, esAgendable: true } });
    if (!own?.activo || !own.esAgendable) throw new IAToolInputError('Tu usuario no está habilitado para recibir citas.');
    return own;
  }
  const employees = await prisma.empleado.findMany({
    where: {
      activo: true,
      esAgendable: true,
      ...(query ? { nombre: { contains: query, mode: 'insensitive' } } : {}),
    },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
    take: 8,
  });
  const exact = query
    ? employees.find((employee: { nombre: string }) => employee.nombre.localeCompare(query, 'es', { sensitivity: 'base' }) === 0)
    : undefined;
  if (exact) return exact;
  if (employees.length === 1) return employees[0];
  if (employees.length === 0) throw new IAToolInputError('No encontré un profesional disponible con ese nombre.');
  throw new IAToolInputError(`Indica el profesional: ${employees.map((employee: { nombre: string }) => employee.nombre).join(', ')}.`);
}

export async function prepareCreateClient(args: unknown): Promise<IAPendingAction> {
  const data = createClientSchema.parse(args);
  const phone = clean(data.telefono);
  const email = clean(data.email);
  const duplicate = await prisma.cliente.findFirst({
    where: {
      OR: [
        ...(phone ? [{ telefono: phone }] : [{ nombre: { equals: data.nombre, mode: 'insensitive' } }]),
        ...(email ? [{ correo: { equals: email, mode: 'insensitive' } }] : []),
      ],
    },
    select: { nombre: true, telefono: true },
  });
  if (duplicate) throw new IAToolInputError(`Ya existe un cliente llamado ${duplicate.nombre}${duplicate.telefono ? ` (${duplicate.telefono})` : ''}. Búscalo antes de crear otro.`);

  return {
    type: 'CREATE_CLIENT',
    title: 'Registrar cliente',
    description: 'Revisa los datos antes de guardarlos en el directorio.',
    confirmLabel: 'Sí, registrar cliente',
    endpoint: '/api/clientes',
    method: 'POST',
    body: { nombre: data.nombre, telefono: phone, correo: email, notas: clean(data.notas) },
    details: [
      { label: 'Nombre', value: data.nombre },
      { label: 'Teléfono', value: phone ?? 'No indicado' },
      ...(email ? [{ label: 'Correo', value: email }] : []),
    ],
  };
}

export async function prepareCreateAppointment(args: unknown, context: IAExecutionContext): Promise<IAPendingAction> {
  const data = createAppointmentSchema.parse(args);
  if (data.fecha < getBusinessTodayString()) throw new IAToolInputError('La fecha de la cita no puede estar en el pasado.');

  const [service, employee] = await Promise.all([
    resolveService(data.servicio),
    resolveEmployee(clean(data.profesional), context),
  ]);
  const availability = await calculateAppointmentAvailability(employee.id, data.fecha, service.id, service.duracion, data.hora);
  const requested = availability.bloques?.find((slot: { hora: string }) => slot.hora === data.hora);
  if (!availability.disponible || !requested?.disponible) {
    const alternatives = (availability.bloques ?? [])
      .filter((slot: { disponible: boolean }) => slot.disponible)
      .slice(0, 6)
      .map((slot: { hora: string }) => slot.hora);
    throw new IAToolInputError(`Ese horario no está disponible.${alternatives.length ? ` Horas disponibles: ${alternatives.join(', ')}.` : ''}`);
  }

  const client = await prisma.cliente.findFirst({
    where: clean(data.telefono)
      ? { telefono: clean(data.telefono) }
      : { nombre: { equals: data.cliente, mode: 'insensitive' } },
    select: { id: true, nombre: true, telefono: true },
  });

  return {
    type: 'CREATE_APPOINTMENT',
    title: 'Crear cita',
    description: 'El horario está disponible. Confirma para guardarlo en la agenda.',
    confirmLabel: 'Sí, crear cita',
    endpoint: '/api/citas',
    method: 'POST',
    body: {
      cliente_id: client?.id,
      cliente_nombre: client?.nombre ?? data.cliente,
      cliente_telefono: client?.telefono ?? clean(data.telefono),
      servicio_id: service.id,
      empleado_id: employee.id,
      fecha: data.fecha,
      hora: data.hora,
      notas: clean(data.notas),
    },
    details: [
      { label: 'Cliente', value: client?.nombre ?? data.cliente },
      { label: 'Servicio', value: `${service.nombre} · ${service.duracion} min` },
      { label: 'Profesional', value: employee.nombre },
      { label: 'Fecha', value: data.fecha },
      { label: 'Hora', value: data.hora },
    ],
  };
}

export async function prepareUpdateAppointmentStatus(args: unknown, context: IAExecutionContext): Promise<IAPendingAction> {
  const data = updateStatusSchema.parse(args);
  const appointment = await prisma.cita.findFirst({
    where: { id: data.citaId, ...(context.userRole === 'EMPLEADO' ? { empleado_id: context.userId } : {}) },
    select: { id: true, cliente_nombre: true, fecha: true, hora: true, estado: true },
  });
  if (!appointment) throw new IAToolInputError('No encontré esa cita o no tienes permiso para modificarla.');
  if (appointment.estado === data.estado) throw new IAToolInputError(`La cita ya está en estado ${data.estado}.`);

  return {
    type: 'UPDATE_APPOINTMENT_STATUS',
    title: 'Cambiar estado de la cita',
    description: 'Este cambio quedará registrado en la auditoría.',
    confirmLabel: 'Sí, cambiar estado',
    endpoint: `/api/citas/${appointment.id}`,
    method: 'PATCH',
    body: { estado: data.estado, ...(data.estado === EstadoCita.CANCELADA ? { cancel_reason: clean(data.motivo) } : {}) },
    details: [
      { label: 'Cliente', value: appointment.cliente_nombre },
      { label: 'Cita', value: `${appointment.fecha.toISOString().slice(0, 10)} · ${appointment.hora}` },
      { label: 'Estado actual', value: appointment.estado },
      { label: 'Nuevo estado', value: data.estado },
    ],
  };
}
