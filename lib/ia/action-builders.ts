import { EstadoCita, TipoPreferenciaCliente } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { calculateAppointmentAvailability } from '@/lib/appointments/appointment-availability';
import { getBusinessTodayString, parseLocalDateToUTC } from '@/lib/timezone';
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

const appointmentQuerySchema = z.object({
  query: z.string().trim().min(2).max(150),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

const updateStatusByQuerySchema = appointmentQuerySchema.extend({
  estado: z.nativeEnum(EstadoCita),
  motivo: optionalText(300),
});

const addWaitlistSchema = z.object({
  cliente: z.string().trim().min(2).max(150),
  servicio: optionalText(100),
  profesional: optionalText(100),
  fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  jornadaPreferida: z.enum(['MANANA', 'TARDE', 'CUALQUIERA']).optional().default('CUALQUIERA'),
  notas: optionalText(500),
  prioridad: z.number().int().min(0).max(2).optional().default(0),
});

const addClientPreferenceSchema = z.object({
  cliente: z.string().trim().min(2).max(150),
  tipo: z.nativeEnum(TipoPreferenciaCliente),
  titulo: z.string().trim().min(2).max(80),
  detalle: z.string().trim().min(2).max(1000),
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

async function resolveClient(query: string) {
  const clients = await prisma.cliente.findMany({
    where: { OR: [
      { nombre: { contains: query, mode: 'insensitive' } },
      { telefono: { contains: query, mode: 'insensitive' } },
    ] },
    select: { id: true, nombre: true, telefono: true },
    orderBy: { nombre: 'asc' },
    take: 6,
  });
  const exact = clients.find((client: { nombre: string }) => client.nombre.localeCompare(query, 'es', { sensitivity: 'base' }) === 0);
  if (exact) return exact;
  if (clients.length === 1) return clients[0];
  if (clients.length === 0) throw new IAToolInputError(`No encontré un cliente llamado “${query}”.`);
  throw new IAToolInputError(`Encontré varios clientes: ${clients.map((client: { nombre: string }) => client.nombre).join(', ')}. Indica el nombre completo.`);
}

async function resolveAppointmentByQuery(args: unknown, context: IAExecutionContext) {
  const data = appointmentQuerySchema.parse(args);
  const fecha = data.fecha ?? getBusinessTodayString();
  const appointments = await prisma.cita.findMany({
    where: {
      fecha: parseLocalDateToUTC(fecha),
      ...(data.hora ? { hora: data.hora } : {}),
      ...(context.userRole === 'EMPLEADO' ? { empleado_id: context.userId } : {}),
      OR: [
        { cliente_nombre: { contains: data.query, mode: 'insensitive' } },
        { cliente_telefono: { contains: data.query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, cliente_nombre: true, cliente_telefono: true, fecha: true, hora: true, estado: true, servicio: { select: { nombre: true } }, empleado: { select: { nombre: true } } },
    orderBy: { hora: 'asc' },
    take: 8,
  });
  if (appointments.length === 0) throw new IAToolInputError(`No encontré una cita de ${data.query} para ${fecha}.`);
  if (appointments.length > 1) throw new IAToolInputError(`Encontré varias citas: ${appointments.map((item: { cliente_nombre: string; hora: string }) => `${item.cliente_nombre} a las ${item.hora}`).join(', ')}. Indica también la hora.`);
  return appointments[0];
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

export async function prepareUpdateAppointmentStatusByQuery(args: unknown, context: IAExecutionContext): Promise<IAPendingAction> {
  const data = updateStatusByQuerySchema.parse(args);
  const appointment = await resolveAppointmentByQuery(data, context);
  return prepareUpdateAppointmentStatus({ citaId: appointment.id, estado: data.estado, motivo: data.motivo }, context);
}

export async function prepareAddWaitlist(args: unknown, context: IAExecutionContext): Promise<IAPendingAction> {
  const data = addWaitlistSchema.parse(args);
  const client = await resolveClient(data.cliente);
  const [service, employee] = await Promise.all([
    data.servicio ? resolveService(data.servicio) : null,
    data.profesional ? resolveEmployee(data.profesional, context) : null,
  ]);
  return {
    type: 'ADD_WAITLIST', title: 'Agregar a lista de espera',
    description: 'Se avisará manualmente por WhatsApp cuando se libere un espacio.',
    confirmLabel: 'Sí, agregar a la lista', endpoint: '/api/lista-espera', method: 'POST',
    body: {
      clienteId: client.id, servicioId: service?.id, empleadoId: employee?.id,
      fechaDesde: data.fechaDesde, fechaHasta: data.fechaHasta,
      jornadaPreferida: data.jornadaPreferida, notas: clean(data.notas), prioridad: data.prioridad,
    },
    details: [
      { label: 'Cliente', value: client.nombre },
      { label: 'Servicio', value: service?.nombre ?? 'Cualquier servicio' },
      { label: 'Profesional', value: employee?.nombre ?? 'Cualquiera disponible' },
      { label: 'Horario', value: data.jornadaPreferida === 'MANANA' ? 'Por la mañana' : data.jornadaPreferida === 'TARDE' ? 'Por la tarde' : 'Cualquier hora' },
    ],
  };
}

export async function prepareAddClientPreference(args: unknown): Promise<IAPendingAction> {
  const data = addClientPreferenceSchema.parse(args);
  const client = await resolveClient(data.cliente);
  return {
    type: 'ADD_CLIENT_PREFERENCE', title: 'Guardar preferencia del cliente',
    description: 'La nota quedará en la ficha para futuras visitas.',
    confirmLabel: 'Sí, guardar preferencia', endpoint: `/api/clientes/${client.id}/preferencias`, method: 'POST',
    body: { tipo: data.tipo, titulo: data.titulo, detalle: data.detalle },
    details: [
      { label: 'Cliente', value: client.nombre },
      { label: 'Tipo', value: data.tipo.charAt(0) + data.tipo.slice(1).toLowerCase() },
      { label: 'Título', value: data.titulo },
      { label: 'Detalle', value: data.detalle },
    ],
  };
}

export async function prepareWhatsAppReminder(args: unknown, context: IAExecutionContext): Promise<IAPendingAction> {
  const appointment = await resolveAppointmentByQuery(args, context);
  if (!appointment.cliente_telefono) throw new IAToolInputError(`${appointment.cliente_nombre} no tiene teléfono registrado.`);
  return {
    type: 'OPEN_WHATSAPP_REMINDER', title: 'Preparar recordatorio por WhatsApp',
    description: 'Se abrirá WhatsApp con el mensaje listo. Tú decides si lo envías.',
    confirmLabel: 'Abrir WhatsApp', endpoint: `/api/citas/${appointment.id}/calendario`, method: 'GET', body: {},
    details: [
      { label: 'Cliente', value: appointment.cliente_nombre },
      { label: 'Cita', value: `${appointment.fecha.toISOString().slice(0, 10)} · ${appointment.hora}` },
      { label: 'Servicio', value: appointment.servicio.nombre },
      { label: 'Profesional', value: appointment.empleado.nombre },
    ],
  };
}
