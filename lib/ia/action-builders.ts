import { EstadoCita, TipoPreferenciaCliente } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { calculateAppointmentAvailability, timeToMinutes } from '@/lib/appointments/appointment-availability';
import { getBusinessTodayString, parseLocalDateToUTC } from '@/lib/timezone';
import { isExactClientDirectoryMatch, resolveClientDirectory, searchClientDirectory } from '@/lib/clients/client-search';
import { resolveEmployeeDirectory, resolveServiceDirectory, searchEmployeeDirectory } from '@/lib/catalog/catalog-search';
import { buildClientDirectoryResponse } from '@/lib/client-privacy';
import type { IAChoiceRequest, IAExecutionContext, IAPendingAction } from './types';

export class IAToolInputError extends Error {
  constructor(message: string, public readonly choiceRequest?: IAChoiceRequest) {
    super(message);
    this.name = 'IAToolInputError';
  }
}

const MAX_FLEXIBLE_TIME_MINUTES = 30;

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

const createClientSchema = z.object({
  nombre: z.string().trim().min(2).max(150),
  telefono: optionalText(30),
  email: z.string().trim().email().max(254).optional().nullable(),
  notas: optionalText(500),
});

const createAppointmentSchema = z.object({
  clienteId: z.string().uuid().optional(),
  cliente: z.string().trim().min(2).max(150),
  telefono: optionalText(30),
  servicioId: z.string().uuid().optional(),
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
  const result = await resolveServiceDirectory(query, { limit: 8 });
  if (result.kind === 'found') return result.item;
  if (result.kind === 'not_found') throw new IAToolInputError(`No encontré un servicio activo llamado “${query}”.`);
  throw new IAToolInputError(`Encontré varios servicios: ${result.items.map((service) => service.nombre).join(', ')}. Indica uno exactamente.`);
}

async function resolveSelectedService(id: string | undefined, query: string) {
  if (!id) return resolveService(query);
  const service = await prisma.servicio.findFirst({
    where: { id, activo: true },
    select: { id: true, nombre: true, duracion: true },
  });
  if (!service) throw new IAToolInputError('El servicio seleccionado ya no está disponible. Elige otro servicio.');
  return service;
}

async function resolveEmployee(query: string | undefined, context: IAExecutionContext) {
  if (context.userRole === 'EMPLEADO') {
    const own = await prisma.empleado.findUnique({ where: { id: context.userId }, select: { id: true, nombre: true, activo: true, esAgendable: true } });
    if (!own?.activo || !own.esAgendable) throw new IAToolInputError('Tu usuario no está habilitado para recibir citas.');
    return own;
  }
  const normalizedQuery = query ?? '';
  const result = normalizedQuery
    ? await resolveEmployeeDirectory(normalizedQuery, { limit: 8 })
    : { kind: 'ambiguous' as const, items: await searchEmployeeDirectory('', { limit: 8 }) };
  if (result.kind === 'found') return result.item;
  if (result.kind === 'not_found' || result.items.length === 0) throw new IAToolInputError('No encontré un profesional disponible con ese nombre.');
  throw new IAToolInputError(`Indica el profesional: ${result.items.map((employee) => employee.nombre).join(', ')}.`);
}

function clientChoiceDescription(client: { telefono: string | null; correo: string | null; cedula: string | null }): string {
  if (client.telefono) return `Tel. ${client.telefono}`;
  if (client.correo) return client.correo;
  if (client.cedula) return `Cédula terminada en ${client.cedula.replace(/\D/g, '').slice(-4) || client.cedula.slice(-4)}`;
  return 'Sin teléfono ni correo registrado';
}

async function resolveClient(query: string, context: IAExecutionContext) {
  const result = await resolveClientDirectory(query, { limit: 8 });
  if (result.kind === 'found') return buildClientDirectoryResponse(result.client, context.userRole);
  if (result.kind === 'not_found') {
    throw new IAToolInputError(`No encontré a “${query}” en Clientes. Regístralo primero y vuelve a crear la cita. No se creó ningún cliente.`);
  }
  const choiceRequest: IAChoiceRequest = {
    kind: 'client',
    prompt: 'Encontré más de un cliente. ¿Cuál deseas usar?',
    options: result.clients.map((client) => {
      const visibleClient = buildClientDirectoryResponse(client, context.userRole);
      return {
        id: visibleClient.id,
        label: visibleClient.nombre,
        description: clientChoiceDescription(visibleClient),
      };
    }),
  };
  throw new IAToolInputError('Encontré varios clientes con ese nombre. Elige el registro correcto para continuar.', choiceRequest);
}

async function resolveSelectedClient(id: string | undefined, query: string, context: IAExecutionContext) {
  if (!id) return resolveClient(query, context);
  const client = await prisma.cliente.findUnique({
    where: { id },
    select: { id: true, nombre: true, telefono: true, correo: true, cedula: true },
  });
  if (!client) throw new IAToolInputError('El cliente seleccionado ya no existe. Búscalo de nuevo en Clientes.');
  return buildClientDirectoryResponse(client, context.userRole);
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

export async function prepareCreateClient(args: unknown, context: IAExecutionContext): Promise<IAPendingAction> {
  const data = createClientSchema.parse(args);
  const phone = clean(data.telefono);
  const email = clean(data.email);
  const duplicateResults = await Promise.all(
    [phone, email, data.nombre].filter((query): query is string => Boolean(query))
      .map(async (query) => ({
        query,
        clients: await searchClientDirectory(query, { limit: 50 }),
      })),
  );
  const duplicate = duplicateResults
    .flatMap(({ query, clients }) => clients.filter((client) => isExactClientDirectoryMatch(client, query)))[0];
  if (duplicate) {
    const client = buildClientDirectoryResponse(duplicate, context.userRole);
    throw new IAToolInputError(`Ya existe un cliente llamado ${client.nombre}${client.telefono ? ` (${client.telefono})` : ''}. Búscalo antes de crear otro.`);
  }

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

  const [client, service, employee] = await Promise.all([
    resolveSelectedClient(data.clienteId, data.cliente, context),
    resolveSelectedService(data.servicioId, data.servicio),
    resolveEmployee(clean(data.profesional), context),
  ]);
  const availability = await calculateAppointmentAvailability(employee.id, data.fecha, service.id, service.duracion, data.hora);
  const requested = availability.bloques?.find((slot: { hora: string }) => slot.hora === data.hora);
  const availableSlots = (availability.bloques ?? [])
    .filter((slot: { disponible: boolean }) => slot.disponible)
    .sort((a: { hora: string }, b: { hora: string }) => {
      const requestedMinutes = timeToMinutes(data.hora);
      const distance = Math.abs(timeToMinutes(a.hora) - requestedMinutes) - Math.abs(timeToMinutes(b.hora) - requestedMinutes);
      return distance || a.hora.localeCompare(b.hora);
    });
  const closest = availableSlots[0];
  const closestDistance = closest ? Math.abs(timeToMinutes(closest.hora) - timeToMinutes(data.hora)) : Number.POSITIVE_INFINITY;
  const adjustedTime = availability.disponible && !requested?.disponible && closestDistance <= MAX_FLEXIBLE_TIME_MINUTES
    ? closest.hora
    : undefined;

  if (!availability.disponible || (!requested?.disponible && !adjustedTime)) {
    const alternatives = availableSlots.slice(0, 6).map((slot: { hora: string }) => slot.hora);
    throw new IAToolInputError(`Ese horario no está disponible.${alternatives.length ? ` Horas disponibles: ${alternatives.join(', ')}.` : ''}`);
  }
  const appointmentTime = adjustedTime ?? data.hora;

  return {
    type: 'CREATE_APPOINTMENT',
    title: 'Crear cita',
    description: adjustedTime
      ? `La hora ${data.hora} no estaba disponible. Encontré ${adjustedTime}, la opción más cercana. Confirma solo si te sirve.`
      : 'El horario está disponible. Confirma para guardarlo en la agenda.',
    confirmLabel: 'Sí, crear cita',
    endpoint: '/api/citas',
    method: 'POST',
    body: {
      cliente_id: client.id,
      cliente_nombre: client.nombre,
      cliente_telefono: client.telefono,
      servicio_id: service.id,
      empleado_id: employee.id,
      fecha: data.fecha,
      hora: appointmentTime,
      notas: clean(data.notas),
    },
    details: [
      { label: 'Cliente', value: client.nombre },
      { label: 'Servicio', value: `${service.nombre} · ${service.duracion} min` },
      { label: 'Profesional', value: employee.nombre },
      { label: 'Fecha', value: data.fecha },
      ...(adjustedTime
        ? [
            { label: 'Hora solicitada', value: data.hora },
            { label: 'Hora disponible', value: adjustedTime },
          ]
        : [{ label: 'Hora', value: data.hora }]),
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
  const client = await resolveClient(data.cliente, context);
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

export async function prepareAddClientPreference(args: unknown, context: IAExecutionContext): Promise<IAPendingAction> {
  const data = addClientPreferenceSchema.parse(args);
  const client = await resolveClient(data.cliente, context);
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
