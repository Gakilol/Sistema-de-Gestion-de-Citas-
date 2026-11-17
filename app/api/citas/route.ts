import { createAppointmentInTransaction } from '@/lib/appointments/create-appointment';
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { isValidBusinessDateString, parseLocalDateToUTC } from '@/lib/timezone';
import {
  getDefaultAppointmentScope,
  getUserContext,
  getScopedAppointmentWhere,
} from '@/lib/auth-helpers';
import { resolveClientDirectory } from '@/lib/clients/client-search';

const ServicioSeleccionadoSchema = z.object({
  id: z.string().uuid(),
  duracion: z.number().int().positive().optional(),
}).passthrough();

const CreateCitaSchema = z.object({
  cliente_id:              z.string().uuid().nullish(),
  cliente_nombre:          z.string().min(2).max(150).trim(),
  cliente_telefono:        z.string().max(30).trim().nullish(),
  servicio_id:             z.string().uuid().nullish(),
  servicio_ids:            z.array(z.string().uuid()).nullish(),
  servicios_seleccionados: z.array(ServicioSeleccionadoSchema).nullish(),
  empleado_id:             z.string().uuid().nullish(),
  fecha:                   z.string().refine(isValidBusinessDateString, 'Fecha inválida (use un día existente en formato YYYY-MM-DD)'),
  hora:                    z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (debe ser HH:MM)'),
  notas:                   z.string().max(2000).nullish(),
  forzar:                  z.boolean().nullish(),
  overrideSchedule:        z.boolean().nullish(),
  allowOverlap:            z.boolean().nullish(),
  overlapReason:           z.string().max(500).nullish(),
}).transform(data => {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    cleaned[key] = value === null ? undefined : value;
  }
  return cleaned;
});

export async function GET(req: NextRequest) {
  try {

    const { userId, userRole } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 401 });
    }

    const estado   = req.nextUrl.searchParams.get('estado') || '';
    const busqueda = req.nextUrl.searchParams.get('q') || '';
    const scope    = req.nextUrl.searchParams.get('scope') || getDefaultAppointmentScope(userRole);
    const filterEmp = req.nextUrl.searchParams.get('empleado_id') || '';
    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');
    if ((from && !isValidBusinessDateString(from)) || (to && !isValidBusinessDateString(to))) {
      return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
    }
    const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '100') || 100));

    const cursor = req.nextUrl.searchParams.get('cursor');
    const scopeWhere = getScopedAppointmentWhere(userId, userRole, scope, filterEmp);

    const citas = await prisma.cita.findMany({
      where: {
        ...(estado && estado !== 'all' ? { estado: estado as any } : {}),
        ...(from || to ? {
          fecha: {
            ...(from ? { gte: parseLocalDateToUTC(from) } : {}),
            ...(to ? { lte: parseLocalDateToUTC(to) } : {}),
          },
        } : {}),
        ...(busqueda ? {
          OR: [
            { cliente_nombre: { contains: busqueda, mode: 'insensitive' } },
            { cliente_telefono: { contains: busqueda, mode: 'insensitive' } },
            { servicio: { nombre: { contains: busqueda, mode: 'insensitive' } } },
          ],
        } : {}),
        ...scopeWhere,
      },
      include: {
        empleado: { select: { id: true, nombre: true, tituloCliente: true } },
        servicio: {
          select: {
            nombre: true,
            categoriaRel: { select: { nombre: true, color: true } }
          }
        },
        citaServicios: {
          include: {
            servicio: {
              select: {
                id: true,
                nombre: true,
                duracion: true,
                categoriaRel: { select: { nombre: true, color: true } }
              }
            }
          },
          orderBy: { orden: 'asc' }
        }
      },
      orderBy: [{ fecha: 'desc' }, { hora: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = citas.length > limit;
    const results = citas.slice(0, limit);
    return NextResponse.json({ citas: results, limit, nextCursor: hasMore ? results.at(-1)?.id : null }, { status: 200 });
  } catch (error: any) {
    console.error('[CITAS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Error al consultar las citas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const { userId, userRole } = getUserContext(req);

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no identificado' }, { status: 401 });
    }

    const parseResult = CreateCitaSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error('[CITAS_VALIDATION_ERROR]', parseResult.error.flatten().fieldErrors);
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parseResult.data;
    const {
      cliente_id,
      cliente_nombre,
      cliente_telefono,
      servicio_id,
      servicio_ids,
      servicios_seleccionados,
      empleado_id,
      fecha,
      hora,
      notas,
      forzar,
      overrideSchedule,
      allowOverlap,
      overlapReason,
    } = body;

    let finalEmpleadoId = empleado_id;
    if (userRole === 'EMPLEADO') {
      finalEmpleadoId = userId;
    }

    if (!finalEmpleadoId) {
      return NextResponse.json({ error: 'Debe especificar el empleado para la cita' }, { status: 400 });
    }
    const targetEmpleado = await prisma.empleado.findUnique({
      where: { id: finalEmpleadoId }
    });

    if (!targetEmpleado || !targetEmpleado.activo) {
      return NextResponse.json({ error: 'El estilista seleccionado no existe o no está activo.' }, { status: 400 });
    }

    if (!targetEmpleado.esAgendable) {
      return NextResponse.json({ error: 'No se permiten citas para personal no agendable o de soporte técnico.' }, { status: 400 });
    }

    // Resolver servicios
    let serviciosParaCita: { id: string; duracion: number }[] = [];
    try {
      if (Array.isArray(servicios_seleccionados) && servicios_seleccionados.length > 0) {
        const ids = servicios_seleccionados.map((s: any) => s.id);
        const serviciosDb = await prisma.servicio.findMany({ where: { id: { in: ids } } });
        
        serviciosParaCita = servicios_seleccionados.map((sel: any) => {
          const sDb = serviciosDb.find((s: any) => s.id === sel.id);
          if (!sDb) {
            throw new Error(`El servicio seleccionado no existe o no está disponible`);
          }
          return {
            id: sel.id,
            duracion: typeof sel.duracion === 'number' && sel.duracion > 0 ? sel.duracion : (sDb.duracion || 30),
          };
        });
      } else {
        const ids = Array.isArray(servicio_ids) && servicio_ids.length > 0 ? servicio_ids : [servicio_id];
        if (!ids[0]) {
          return NextResponse.json({ error: 'No se especificaron servicios para la cita' }, { status: 400 });
        }
        const idsDefinidos = ids.filter((id): id is string => id !== undefined && id !== null);
        if (idsDefinidos.length === 0) {
          return NextResponse.json({ error: 'No se especificaron servicios para la cita' }, { status: 400 });
        }
        const serviciosDb = await prisma.servicio.findMany({ where: { id: { in: idsDefinidos } } });
        
        serviciosParaCita = idsDefinidos.map((id: string) => {
          const sDb = serviciosDb.find((s: any) => s.id === id);
          if (!sDb) {
            throw new Error(`El servicio con ID ${id} no fue encontrado`);
          }
          return {
            id: sDb.id,
            duracion: sDb.duracion,
          };
        });
      }
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const duracionCalculada = serviciosParaCita.reduce((sum, s) => sum + s.duracion, 0);
    const primerServicioId  = serviciosParaCita[0].id;
    // Excepción de horario: Todos los roles autenticados (ADMIN, TECH_SUPPORT, EMPLEADO)
    const permitirHorarioExtendido = Boolean(overrideSchedule || forzar || userRole === 'ADMIN' || userRole === 'EMPLEADO' || userRole === 'TECH_SUPPORT');


    // ─── GESTIÓN DE CLIENTE ─────────────────────────────────────────────────
    let idClienteFinal: string | null = cliente_id || null;
    let finalClienteNombre = cliente_nombre.trim();
    let finalClienteTelefono: string | null = cliente_telefono?.trim() || null;

    if (idClienteFinal) {
      const dbCliente = await prisma.cliente.findUnique({
        where: { id: idClienteFinal }
      });
      if (dbCliente) {
        finalClienteNombre = dbCliente.nombre.trim();
        finalClienteTelefono = dbCliente.telefono?.trim() || null;
      } else {
        return NextResponse.json({ error: 'El cliente seleccionado ya no existe. Búscalo de nuevo antes de crear la cita.' }, { status: 400 });
      }
    } else {
      const clientQuery = finalClienteTelefono || finalClienteNombre;
      const resolution = await resolveClientDirectory(clientQuery, { limit: 8 });
      if (resolution.kind === 'not_found') {
        return NextResponse.json({
          error: 'No encontré ese cliente en el directorio. Regístralo primero y luego selecciónalo para crear la cita.',
        }, { status: 400 });
      }
      if (resolution.kind === 'ambiguous') {
        return NextResponse.json({
          error: `Encontré varios clientes similares: ${resolution.clients.map((client) => client.nombre).join(', ')}. Selecciona el registro correcto.`,
          matches: resolution.clients,
        }, { status: 409 });
      }
      idClienteFinal = resolution.client.id;
      finalClienteNombre = resolution.client.nombre.trim();
      finalClienteTelefono = resolution.client.telefono?.trim() || null;
    }

    // ─── TRANSACCIÓN ATÓMICA: Validación + Lock + Guardar cita ─────────────
    const result = await prisma.$transaction((tx: any) => createAppointmentInTransaction(tx, {
      finalEmpleadoId, fecha, primerServicioId, duracionCalculada, hora, permitirHorarioExtendido, allowOverlap, userRole, userId, serviciosParaCita, idClienteFinal, finalClienteNombre, finalClienteTelefono, notas, overlapReason
    }));

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    if ('type' in result && result.type === 'SCHEDULE_OVERLAP') {
      return NextResponse.json(result, { status: result.status });
    }

    const { cita, conflictos } = result;

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: 'APPOINTMENT_CREATED',
      module: 'CITAS',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail: req.headers.get('x-user-email'),
      entityType: 'Cita',
      entityId: cita.id,
      entityName: cliente_nombre,
      description: `Cita creada para ${cliente_nombre}.${cita.allowOverlap ? ' (Traslape controlado permitido)' : ''}`,
      afterData: cita,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: {
        allowOverlap: cita.allowOverlap,
        overrideSchedule: Boolean(overrideSchedule || forzar),
        requestedDate: fecha,
      }
    });

    if (cita.allowOverlap) {
      await logAudit({
        action: 'APPOINTMENT_OVERLAP_CONFIRMED',
        module: 'CITAS',
        status: 'SUCCESS',
        userId: userId || undefined,
        userRole: userRole || undefined,
        userEmail: req.headers.get('x-user-email'),
        entityType: 'Cita',
        entityId: cita.id,
        entityName: cliente_nombre,
        description: `Traslape de horario confirmado para la cita de ${cliente_nombre} con el motivo: "${cita.overlapReason || 'Sin motivo'}"`,
        afterData: cita,
        ipAddress: getClientIp(req.headers),
        userAgent: req.headers.get('user-agent') || undefined,
        metadata: {
          conflicts: conflictos,
          overlapReason: cita.overlapReason,
          confirmedById: cita.overlapConfirmedById,
          confirmedAt: cita.overlapConfirmedAt
        }
      });
    }

    const citaCreada = await prisma.cita.findUnique({
      where: { id: cita.id },
      include: {
        empleado: { select: { id: true, nombre: true, correo: true, tituloCliente: true } },
        servicio: { select: { id: true, nombre: true, duracion: true } },
        citaServicios: {
          include: { servicio: { select: { id: true, nombre: true, duracion: true } } },
          orderBy: { orden: 'asc' },
        },
      },
    });

    return NextResponse.json({ cita: citaCreada ?? cita, mensaje: 'Cita creada exitosamente con sus servicios' }, { status: 201 });
  } catch (error: any) {
    console.error('[CITAS_POST_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Error al procesar la cita' }, { status: 400 });
  }
}
