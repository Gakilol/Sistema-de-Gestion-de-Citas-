import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { syncCitaEstados } from '@/lib/automatizacion';
import { parseLocalDateToUTC } from '@/lib/timezone';
import { registrarAuditoria } from '@/lib/auditoria';
import { getUserContext, getScopedAppointmentWhere } from '@/lib/auth-helpers';

const ServicioSeleccionadoSchema = z.object({
  id: z.string().uuid(),
  duracion: z.number().int().positive().optional(),
}).passthrough();

const CreateCitaSchema = z.object({
  cliente_id:              z.string().uuid().nullish(),
  cliente_nombre:          z.string().min(1).max(150).trim(),
  cliente_telefono:        z.string().max(30).trim().nullish(),
  servicio_id:             z.string().uuid().nullish(),
  servicio_ids:            z.array(z.string().uuid()).nullish(),
  servicios_seleccionados: z.array(ServicioSeleccionadoSchema).nullish(),
  empleado_id:             z.string().uuid().nullish(),
  fecha:                   z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Formato de fecha inválido'),
  hora:                    z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato de hora inválido'),
  notas:                   z.string().max(2000).nullish(),
  forzar:                  z.boolean().nullish(),
  allowOverlap:            z.boolean().nullish(),
  overlapReason:           z.string().max(500).nullish(),
}).transform(data => {
  // Normalizar null -> undefined para compatibilidad con el código existente
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    cleaned[key] = value === null ? undefined : value;
  }
  return cleaned;
});


export async function GET(req: NextRequest) {
  try {
    await syncCitaEstados();

    const { userId, userRole } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 401 });
    }

    const estado   = req.nextUrl.searchParams.get('estado') || '';
    const busqueda = req.nextUrl.searchParams.get('q') || '';
    const scope    = req.nextUrl.searchParams.get('scope') || 'mine';
    const filterEmp = req.nextUrl.searchParams.get('empleado_id') || '';

    const scopeWhere = getScopedAppointmentWhere(userId, userRole, scope, filterEmp);

    const citas = await prisma.cita.findMany({
      where: {
        ...(estado && estado !== 'all' ? { estado: estado as any } : {}),
        ...scopeWhere,
      },
      include: {
        empleado: { select: { id: true, nombre: true, correo: true, tituloCliente: true } },
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
      orderBy: [{ fecha: 'desc' }, { hora: 'asc' }],
    });

    const filtradas = busqueda
      ? citas.filter(c =>
          c.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          (c.cliente_telefono && c.cliente_telefono.includes(busqueda)) ||
          c.servicio.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          c.citaServicios.some(cs => cs.servicio.nombre.toLowerCase().includes(busqueda.toLowerCase()))
        )
      : citas;

    return NextResponse.json({ citas: filtradas }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
      allowOverlap,
      overlapReason,
    } = body;

    let finalEmpleadoId = empleado_id;
    if (userRole === 'EMPLEADO') {
      finalEmpleadoId = userId;
    }

    // Validar que el empleado sea agendable
    // Asegurarse que finalEmpleadoId está definido en este punto del flujo
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
          const sDb = serviciosDb.find(s => s.id === sel.id);
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
        // Filtrar posibles undefined antes de pasar a Prisma
        const idsDefinidos = ids.filter((id): id is string => id !== undefined && id !== null);
        if (idsDefinidos.length === 0) {
          return NextResponse.json({ error: 'No se especificaron servicios para la cita' }, { status: 400 });
        }
        const serviciosDb = await prisma.servicio.findMany({ where: { id: { in: idsDefinidos } } });
        
        serviciosParaCita = idsDefinidos.map((id: string) => {
          const sDb = serviciosDb.find(s => s.id === id);
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

    // ─── VALIDACIÓN DE DISPONIBILIDAD ───────────────────────────────────────
    const permitirHorarioExtendido = userRole === 'ADMIN' || userRole === 'EMPLEADO' || userRole === 'TECH_SUPPORT';

    const { calcularDisponibilidad, validarHoraExacta, detectarConflictos } = await import('@/lib/disponibilidad');
    const disponibilidad = await calcularDisponibilidad(
      finalEmpleadoId,
      fecha.split('T')[0],
      primerServicioId,
      duracionCalculada,
      hora,
      null,
      permitirHorarioExtendido
    );

    if (!disponibilidad.disponible) {
      return NextResponse.json({ error: 'El empleado no está disponible este día: ' + disponibilidad.motivo }, { status: 400 });
    }

    if (!disponibilidad.jornada) {
      return NextResponse.json({ error: 'No se pudo determinar la jornada laboral' }, { status: 400 });
    }

    // ─── DETECCIÓN Y VALIDACIÓN DE TRASLAPES CONTROLADOS ───────────────────
    const conflictos = await detectarConflictos(
      finalEmpleadoId,
      fecha.split('T')[0],
      hora,
      duracionCalculada,
      null
    );

    const isOverlapRequested = allowOverlap === true;
    const conflictosBloqueantes = conflictos.filter(c => !c.allowOverlap);

    if (conflictosBloqueantes.length > 0) {
      if (!isOverlapRequested) {
        // Devolver un error controlado con los detalles de la cita en conflicto
        return NextResponse.json({
          type: 'SCHEDULE_OVERLAP',
          message: 'El horario se cruza con otra cita.',
          conflicts: conflictosBloqueantes
        }, { status: 409 });
      }

      // Validar que un empleado solo pueda confirmar traslapes en su propia agenda
      if (userRole === 'EMPLEADO' && finalEmpleadoId !== userId) {
        return NextResponse.json({ error: 'No tienes permiso para crear traslapes en la agenda de otros empleados.' }, { status: 403 });
      }
      if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT' && userRole !== 'EMPLEADO') {
        return NextResponse.json({ error: 'No tienes permiso para confirmar traslapes.' }, { status: 403 });
      }
    }

    // Ejecutar validación de hora exacta
    // Si hay traslape confirmado, filtramos las citas para que no bloqueen la validación,
    // pero mantenemos bloqueos y descansos.
    const intervalosFiltrados = (conflictosBloqueantes.length > 0 && isOverlapRequested)
      ? disponibilidad.intervalosOcupados.filter(int => int.motivo !== 'Cita reservada')
      : disponibilidad.intervalosOcupados;

    const validacion = validarHoraExacta(
      hora,
      duracionCalculada,
      disponibilidad.jornada.inicio,
      disponibilidad.jornada.fin,
      intervalosFiltrados,
      permitirHorarioExtendido,
      disponibilidad.turnosEmpleado
    );

    if (!validacion.valida) {
      return NextResponse.json({ error: 'Hora no disponible: ' + validacion.motivo }, { status: 400 });
    }

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
        idClienteFinal = null;
      }
    }


    // ─── TRANSACCIÓN: Guardar cita + relaciones ──────────────────────────────
    const hasConflict = conflictosBloqueantes.length > 0;
    const cita = await prisma.$transaction(async (tx) => {
      const c = await tx.cita.create({
        data: {
          cliente_id:       idClienteFinal,
          cliente_nombre:   finalClienteNombre.trim(),
          cliente_telefono: finalClienteTelefono?.trim() || null,
          servicio_id:      primerServicioId,
          empleado_id:      finalEmpleadoId,
          fecha:            parseLocalDateToUTC(fecha.split('T')[0]),
          hora,
          duracion:         duracionCalculada,
          notas,
          created_by:       userId,
          // Guardar información de traslape
          allowOverlap:     hasConflict && isOverlapRequested,
          overlapReason:    hasConflict && isOverlapRequested ? overlapReason : null,
          overlapConfirmedById: hasConflict && isOverlapRequested ? userId : null,
          overlapConfirmedAt:   hasConflict && isOverlapRequested ? new Date() : null,
        },
      });

      await tx.citaServicio.createMany({
        data: serviciosParaCita.map((s, index) => ({
          cita_id:     c.id,
          servicio_id: s.id,
          duracion:    s.duracion,
          orden:       index,
        }))
      });

      return c;
    });

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
      metadata: { allowOverlap: cita.allowOverlap }
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

    return NextResponse.json({ cita, mensaje: 'Cita creada exitosamente con sus servicios' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
