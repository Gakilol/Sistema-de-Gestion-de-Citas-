import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { parseLocalDateToUTC } from '@/lib/timezone';
import { registrarAuditoria } from '@/lib/auditoria';
import { getUserContext } from '@/lib/auth-helpers';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, userRole } = getUserContext(req);

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 401 });
    }

    const cita = await prisma.cita.findUnique({
      where: { id },
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
      }
    });

    if (!cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }

    if (userRole === 'EMPLEADO' && cita.empleado_id !== userId) {
      return NextResponse.json({ error: 'No tienes permiso para ver esta cita' }, { status: 403 });
    }

    return NextResponse.json({ cita }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }   = await params;
    const body     = await req.json();
    const { userId, userRole, userEmail } = getUserContext(req);

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no identificado' }, { status: 401 });
    }

    const citaOriginal = await prisma.cita.findUnique({
      where: { id },
      include: { citaServicios: true }
    });

    if (!citaOriginal) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }

    if (userRole === 'EMPLEADO') {
      if (citaOriginal.empleado_id !== userId) {
        return NextResponse.json({ error: 'No tienes permiso para modificar una cita que no te pertenece' }, { status: 403 });
      }
      if (body.empleado_id && body.empleado_id !== userId) {
        return NextResponse.json({ error: 'No tienes permiso para reasignar esta cita a otro estilista' }, { status: 403 });
      }
    }

    const {
      estado,
      notas,
      empleado_id,
      fecha,
      hora,
      servicio_id,
      servicio_ids,
      servicios_seleccionados,
      duracion,
      cliente_id,
      cliente_nombre,
      cliente_telefono,
      forzar,
      cancel_reason,
      allowOverlap,
      overlapReason,
      clientUpdatedAt,
    } = body;

    // ─── DETECCIÓN DE CONCURRENCIA (Drag & Drop / Resize) ────────────────────
    // Si el cliente envió la marca de tiempo de cuando cargó la cita,
    // comparamos con la versión actual del servidor para detectar ediciones concurrentes.
    if (clientUpdatedAt) {
      const clientTime = new Date(clientUpdatedAt);
      const serverTime = new Date(citaOriginal.updated_at);
      if (!isNaN(clientTime.getTime()) && serverTime > clientTime) {
        return NextResponse.json({
          type: 'CONCURRENT_EDIT',
          message: 'Esta cita fue modificada por otro usuario desde que la abriste. Por favor recarga la información.',
        }, { status: 409 });
      }
    }

    // ─── VALIDACIÓN DE ESTADO EDITABLE PARA CAMBIOS DE HORARIO ───────────────
    // Solo aplica cuando el PATCH incluye cambios de fecha/hora/duración/empleado
    // (movimiento visual o resize), no simplemente cambio de estado o notas.
    const esMovimientoVisual = !!(fecha || hora || (duracion !== undefined) || empleado_id);
    const estadosSoloNota = ['COMPLETADA', 'CANCELADA', 'NO_SHOW'];
    if (esMovimientoVisual && estadosSoloNota.includes(citaOriginal.estado)) {
      return NextResponse.json({
        error: `No se puede reprogramar una cita en estado "${citaOriginal.estado}". Solo se permiten cambios de notas o información no temporal.`,
      }, { status: 422 });
    }


    let conflictos: any[] = [];
    let hasOrphanedIntercalada = false;

    // Validar que el nuevo empleado sea agendable
    if (empleado_id) {
      const targetEmpleado = await prisma.empleado.findUnique({
        where: { id: empleado_id }
      });
      if (!targetEmpleado || !targetEmpleado.activo) {
        return NextResponse.json({ error: 'El estilista seleccionado no existe o no está activo.' }, { status: 400 });
      }
      if (!targetEmpleado.esAgendable) {
        return NextResponse.json({ error: 'No se permiten citas para personal no agendable o de soporte técnico.' }, { status: 400 });
      }
    }

    const dataToUpdate: any = {};
    if (estado)               dataToUpdate.estado      = estado;
    if (notas !== undefined)  dataToUpdate.notas       = notas;
    if (empleado_id)          dataToUpdate.empleado_id = empleado_id;
    if (fecha)                dataToUpdate.fecha       = parseLocalDateToUTC(fecha.split('T')[0]);
    if (hora)                 dataToUpdate.hora        = hora;
    if (servicio_id)          dataToUpdate.servicio_id = servicio_id;
    if (duracion !== undefined) dataToUpdate.duracion  = Number(duracion);

    // ─── ANALYTICS TIMESTAMP TRACKING ──────────────────────────────────────
    if (estado === 'CANCELADA') {
      dataToUpdate.cancelled_at = new Date();
      if (cancel_reason !== undefined) dataToUpdate.cancel_reason = cancel_reason || null;
    } else if (estado === 'COMPLETADA') {
      dataToUpdate.completed_at = new Date();
    } else if (estado === 'NO_SHOW') {
      dataToUpdate.no_show_at = new Date();
    }

    // ─── GESTIÓN DE CLIENTE EN EDICIÓN ──────────────────────────────────────
    let idClienteFinal = cliente_id;
    let finalClienteNombre = cliente_nombre;
    let finalClienteTelefono = cliente_telefono;

    if (idClienteFinal) {
      const dbCliente = await prisma.cliente.findUnique({
        where: { id: idClienteFinal }
      });
      if (dbCliente) {
        finalClienteNombre = dbCliente.nombre;
        finalClienteTelefono = dbCliente.telefono;
      }
    } else if (cliente_nombre && !idClienteFinal) {
      const existe = await prisma.cliente.findFirst({
        where: {
          nombre: cliente_nombre.trim(),
          ...(cliente_telefono ? { telefono: cliente_telefono.trim() } : {})
        }
      });
      if (existe) {
        idClienteFinal = existe.id;
        finalClienteNombre = existe.nombre;
        finalClienteTelefono = existe.telefono;
      } else {
        const nuevoC = await prisma.cliente.create({
          data: {
            nombre:   cliente_nombre.trim(),
            telefono: cliente_telefono?.trim() || null,
            createdByUserId: userId,
          }
        });
        idClienteFinal = nuevoC.id;
        finalClienteNombre = nuevoC.nombre;
        finalClienteTelefono = nuevoC.telefono;
      }
    }

    if (idClienteFinal)             dataToUpdate.cliente_id       = idClienteFinal;
    if (finalClienteNombre)         dataToUpdate.cliente_nombre   = finalClienteNombre.trim();
    if (finalClienteTelefono !== undefined) dataToUpdate.cliente_telefono = finalClienteTelefono?.trim() || null;

    let finalServicioIds = servicio_ids;
    if (!finalServicioIds && servicio_id) {
      finalServicioIds = [servicio_id];
    }
    // ─── VALIDACIÓN DE DISPONIBILIDAD AL EDITAR ─────────────────────────────
    const cambiaHorario =
      hora || fecha || empleado_id || (duracion !== undefined) ||
      (Array.isArray(finalServicioIds) && finalServicioIds.length > 0) ||
      (Array.isArray(servicios_seleccionados) && servicios_seleccionados.length > 0);

    if (cambiaHorario) {
      const citaActual = await prisma.cita.findUnique({ where: { id } });
      if (!citaActual) {
        return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
      }

      const empleadoFinal = empleado_id || citaActual.empleado_id;
      const fechaFinal    = fecha
        ? fecha.split('T')[0]
        : new Date(citaActual.fecha).toISOString().split('T')[0];
      const horaFinal     = hora || citaActual.hora;

      let duracionFinal = citaActual.duracion;
      if (duracion !== undefined) {
        duracionFinal = Number(duracion);
      } else if (Array.isArray(servicios_seleccionados) && servicios_seleccionados.length > 0) {
        duracionFinal = servicios_seleccionados.reduce(
          (sum: number, s: any) => sum + (typeof s.duracion === 'number' && s.duracion > 0 ? s.duracion : 30),
          0
        );
      } else if (Array.isArray(finalServicioIds) && finalServicioIds.length > 0) {
        const idsUnicos = [...new Set(finalServicioIds)] as string[];
        const serviciosDb = await prisma.servicio.findMany({ where: { id: { in: idsUnicos } } });
        duracionFinal = finalServicioIds.reduce((sum: number, sid: string) => {
          const sDb = serviciosDb.find(s => s.id === sid);
          return sum + (sDb?.duracion || 30);
        }, 0);
      }

      const permitirHorarioExtendido = userRole === 'ADMIN' || userRole === 'EMPLEADO' || userRole === 'TECH_SUPPORT';

      const { calcularDisponibilidad, validarHoraExacta, detectarConflictos } = await import('@/lib/disponibilidad');
      
      conflictos = await detectarConflictos(
        empleadoFinal,
        fechaFinal,
        horaFinal,
        duracionFinal,
        id // excludeCitaId
      );

      const disponibilidad = await calcularDisponibilidad(
        empleadoFinal,
        fechaFinal,
        null,
        duracionFinal,
        horaFinal,
        id,                        // excludeCitaId = cita actual
        permitirHorarioExtendido
      );

      if (!disponibilidad.disponible) {
        return NextResponse.json(
          { error: 'El empleado no está disponible este día: ' + disponibilidad.motivo },
          { status: 400 }
        );
      }

      const conflictosBloqueantes = conflictos.filter(c => !c.allowOverlap);
      const isOverlapRequested = allowOverlap === true;

      if (conflictosBloqueantes.length > 0) {
        if (!isOverlapRequested) {
          return NextResponse.json({
            type: 'SCHEDULE_OVERLAP',
            message: 'El horario se cruza con otra cita.',
            conflicts: conflictosBloqueantes
          }, { status: 409 });
        }

        // Validar permisos para traslape
        if (userRole === 'EMPLEADO' && empleadoFinal !== userId) {
          return NextResponse.json({ error: 'No tienes permiso para crear traslapes en la agenda de otros empleados.' }, { status: 403 });
        }
        if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT' && userRole !== 'EMPLEADO') {
          return NextResponse.json({ error: 'No tienes permiso para confirmar traslapes.' }, { status: 403 });
        }
      }

      if (disponibilidad.jornada) {
        // Si hay traslape confirmado, filtramos las citas para que no bloqueen la validación,
        // pero mantenemos bloqueos y descansos.
        const intervalosFiltrados = (conflictosBloqueantes.length > 0 && isOverlapRequested)
          ? disponibilidad.intervalosOcupados.filter(int => int.motivo !== 'Cita reservada')
          : disponibilidad.intervalosOcupados;

        const validacion = validarHoraExacta(
          horaFinal,
          duracionFinal,
          disponibilidad.jornada.inicio,
          disponibilidad.jornada.fin,
          intervalosFiltrados,
          permitirHorarioExtendido,
          disponibilidad.turnosEmpleado
        );

        if (!validacion.valida) {
          return NextResponse.json({ error: 'Hora no disponible: ' + validacion.motivo }, { status: 400 });
        }
      }

      // Guardar información de traslape si hay conflictos bloqueantes y se solicita el overlap
      if (conflictosBloqueantes.length > 0 && isOverlapRequested) {
        dataToUpdate.allowOverlap = true;
        dataToUpdate.overlapReason = overlapReason || null;
        dataToUpdate.overlapConfirmedById = userId;
        dataToUpdate.overlapConfirmedAt = new Date();
      } else {
        // Resetear traslape si ya no hay conflictos o no se solicita traslape en el nuevo horario
        dataToUpdate.allowOverlap = false;
        dataToUpdate.overlapReason = null;
        dataToUpdate.overlapConfirmedById = null;
        dataToUpdate.overlapConfirmedAt = null;
      }

      // Detectar si acortamos la cita principal y dejamos huérfana una intercalada
      const originalDate = new Date(citaActual.fecha).toISOString().split('T')[0];
      const allCitasOnDate = await prisma.cita.findMany({
        where: {
          empleado_id: empleadoFinal,
          fecha: parseLocalDateToUTC(originalDate),
          estado: { notIn: ['CANCELADA', 'REPROGRAMADA'] },
          id: { not: id }
        }
      });

      const { timeToMinutes } = await import('@/lib/disponibilidad');
      const startMinOrig = timeToMinutes(citaActual.hora);
      const endMinOrig = startMinOrig + citaActual.duracion;

      const startMinNew = timeToMinutes(horaFinal);
      const endMinNew = startMinNew + duracionFinal;

      for (const otherC of allCitasOnDate) {
        if (otherC.allowOverlap) {
          const otherStart = timeToMinutes(otherC.hora);
          const otherEnd = otherStart + otherC.duracion;
          
          const wasContained = otherStart >= startMinOrig && otherEnd <= endMinOrig;
          const isStillContained = (fechaFinal === originalDate) && (otherStart >= startMinNew && otherEnd <= endMinNew);

          if (wasContained && !isStillContained) {
            hasOrphanedIntercalada = true;
            break;
          }
        }
      }
    }

    // Cita original ya cargada y validada arriba

    // ─── TRANSACCIÓN ────────────────────────────────────────────────────────
    const cita = await prisma.$transaction(async (tx) => {
      let serviciosParaActualizar: { id: string; duracion: number }[] = [];
      let flagActualizarServicios = false;

      if (Array.isArray(servicios_seleccionados) && servicios_seleccionados.length > 0) {
        flagActualizarServicios = true;
        const ids         = servicios_seleccionados.map((s: any) => s.id);
        const idsUnicos   = [...new Set(ids)] as string[];
        const serviciosDb = await tx.servicio.findMany({ where: { id: { in: idsUnicos } } });

        // Preservar duplicados: cada elemento de la lista origina su propio CitaServicio
        serviciosParaActualizar = servicios_seleccionados.map((sel: any) => {
          const sDb = serviciosDb.find(s => s.id === sel.id);
          if (!sDb) {
            throw new Error(`El servicio seleccionado no existe o no está disponible`);
          }
          return {
            id:       sel.id,
            duracion: typeof sel.duracion === 'number' && sel.duracion > 0 ? sel.duracion : (sDb.duracion || 30),
          };
        });

      } else if (Array.isArray(finalServicioIds) && finalServicioIds.length > 0) {
        flagActualizarServicios = true;
        const idsUnicos   = [...new Set(finalServicioIds)] as string[];
        const serviciosDb = await tx.servicio.findMany({ where: { id: { in: idsUnicos } } });

        // Preservar duplicados usando el array original
        serviciosParaActualizar = finalServicioIds.map((sid: string) => {
          const sDb = serviciosDb.find(s => s.id === sid);
          if (!sDb) {
            throw new Error(`El servicio con ID ${sid} no fue encontrado`);
          }
          return {
            id:       sid,
            duracion: sDb.duracion || 30,
          };
        });
      }

      if (flagActualizarServicios && serviciosParaActualizar.length > 0) {
        const duracionCalculada = serviciosParaActualizar.reduce((sum, s) => sum + s.duracion, 0);
        const primerServicioId  = serviciosParaActualizar[0].id;

        dataToUpdate.servicio_id = primerServicioId;
        dataToUpdate.duracion    = duracionCalculada;

        await tx.citaServicio.deleteMany({ where: { cita_id: id } });

        await tx.citaServicio.createMany({
          data: serviciosParaActualizar.map((s, index) => ({
            cita_id:     id,
            servicio_id: s.id,
            duracion:    s.duracion,
            orden:       index,
          }))
        });
      }

      const c = await tx.cita.update({
        where: { id },
        data: dataToUpdate,
        include: {
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
        }
      });

      return c;
    });

    // Detectar acción y descripción
    let finalAction = 'APPOINTMENT_UPDATED';
    let finalDesc = `Cita de ${cita.cliente_nombre} actualizada.`;
    
    if (estado) {
      if (estado === 'CANCELADA') {
        finalAction = 'APPOINTMENT_CANCELLED';
        finalDesc = `Cita de ${cita.cliente_nombre} cancelada. Motivo: ${cancel_reason || 'No especificado'}`;
      } else if (estado === 'COMPLETADA') {
        finalAction = 'APPOINTMENT_COMPLETED';
        finalDesc = `Cita de ${cita.cliente_nombre} marcada como completada.`;
      } else if (estado === 'NO_SHOW') {
        finalAction = 'APPOINTMENT_NO_SHOW';
        finalDesc = `Cita de ${cita.cliente_nombre} marcada como no presentado.`;
      } else if (estado === 'CONFIRMADA') {
        finalAction = 'APPOINTMENT_CONFIRMED';
        finalDesc = `Cita de ${cita.cliente_nombre} confirmada.`;
      } else if (estado === 'REPROGRAMADA') {
        finalAction = 'APPOINTMENT_RESCHEDULED';
        finalDesc = `Cita de ${cita.cliente_nombre} reprogramada.`;
      }
    } else if (hora || fecha) {
      finalAction = 'APPOINTMENT_RESCHEDULED';
      finalDesc = `Cita de ${cita.cliente_nombre} reprogramada a la fecha ${fecha || ''} ${hora || ''}.`;
    }

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: finalAction,
      module: 'CITAS',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail: userEmail || undefined,
      entityType: 'Cita',
      entityId: id,
      entityName: cita.cliente_nombre,
      description: finalDesc,
      beforeData: citaOriginal,
      afterData: cita,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: { cambios: dataToUpdate, forzado: forzar }
    });

    if (cita.allowOverlap && dataToUpdate.allowOverlap) {
      await logAudit({
        action: 'APPOINTMENT_OVERLAP_CONFIRMED',
        module: 'CITAS',
        status: 'SUCCESS',
        userId: userId || undefined,
        userRole: userRole || undefined,
        userEmail: userEmail || undefined,
        entityType: 'Cita',
        entityId: id,
        entityName: cita.cliente_nombre,
        description: `Traslape de horario confirmado al editar la cita de ${cita.cliente_nombre} con el motivo: "${cita.overlapReason || 'Sin motivo'}"`,
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

    return NextResponse.json({ 
      cita, 
      mensaje: 'Cita actualizada exitosamente con sus servicios',
      warning: hasOrphanedIntercalada ? 'Esta cita tiene una cita intercalada dentro del horario anterior. Revise si desea mantenerla, moverla o editarla.' : null
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }   = await params;
    const { userId, userRole, userEmail } = getUserContext(req);

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 401 });
    }

    const cita = await prisma.cita.findUnique({
      where: { id }
    });

    if (!cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }

    // Validar permisos según rol
    if (userRole === 'EMPLEADO') {
      if (cita.created_by !== userId) {
        return NextResponse.json({ error: 'No tienes permiso para eliminar esta cita' }, { status: 403 });
      }
    } else if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'No tienes permiso para eliminar esta cita' }, { status: 403 });
    }

    // Obtener origen de la acción
    const origenParam = req.nextUrl.searchParams.get('origen') || '';
    let friendlyOrigen = 'el sistema';
    if (origenParam === 'agenda') {
      friendlyOrigen = 'Agenda/Calendario';
    } else if (origenParam === 'lista') {
      friendlyOrigen = 'Lista de Citas';
    }

    // Guardar los datos antes de eliminar (evitando datos sensibles redundantes)
    const beforeData = {
      id: cita.id,
      cliente_nombre: cita.cliente_nombre,
      cliente_id: cita.cliente_id,
      empleado_id: cita.empleado_id,
      fecha: cita.fecha,
      hora: cita.hora,
      duracion: cita.duracion,
      estado: cita.estado,
      created_by: cita.created_by,
      created_at: cita.created_at
    };

    await prisma.cita.delete({ where: { id } });

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: 'APPOINTMENT_DELETED',
      module: 'CITAS',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail: userEmail || undefined,
      entityType: 'Cita',
      entityId: id,
      entityName: cita.cliente_nombre,
      description: `Cita de ${cita.cliente_nombre} para el ${cita.fecha.toISOString().split('T')[0]} a las ${cita.hora} con profesional ${cita.empleado_id} eliminada permanentemente desde ${friendlyOrigen}.`,
      beforeData,
      metadata: {
        origen: friendlyOrigen,
        cliente_nombre: cita.cliente_nombre,
        empleado_id: cita.empleado_id,
        fecha: cita.fecha,
        hora: cita.hora
      },
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
    });

    return NextResponse.json({ mensaje: 'Cita eliminada exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
