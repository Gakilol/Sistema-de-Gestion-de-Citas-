import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { parseLocalDateToUTC } from '@/lib/timezone';
import { registrarAuditoria } from '@/lib/auditoria';
import { getUserContext } from '@/lib/auth-helpers';
import { parseCurrencyCRC, calcularTotalCita } from '@/lib/utils';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role') || '';
    const userId   = req.headers.get('x-user-id');

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 401 });
    }

    const cita = await prisma.cita.findUnique({
      where: { id },
      include: {
        empleado: { select: { nombre: true, tituloCliente: true } },
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
    const { userId, userRole } = getUserContext(req);

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
    } = body;

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
      hora || fecha || empleado_id ||
      (Array.isArray(finalServicioIds) && finalServicioIds.length > 0) ||
      (Array.isArray(servicios_seleccionados) && servicios_seleccionados.length > 0);

    const esForzado = forzar === true && (userRole === 'ADMIN' || userRole === 'TECH_SUPPORT');

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

      // ─── Calcular duración final, conservando duplicados ─────────────────
      // CORRECCIÓN: Si el cliente envía servicios_seleccionados con duplicados,
      // la duración se suma para cada elemento (no para IDs únicos).
      let duracionFinal = citaActual.duracion;
      if (Array.isArray(servicios_seleccionados) && servicios_seleccionados.length > 0) {
        duracionFinal = servicios_seleccionados.reduce(
          (sum: number, s: any) => sum + (typeof s.duracion === 'number' && s.duracion > 0 ? s.duracion : 30),
          0
        );
      } else if (Array.isArray(finalServicioIds) && finalServicioIds.length > 0) {
        // Para IDs, preservar duplicados en la suma
        const idsUnicos = [...new Set(finalServicioIds)] as string[];
        const serviciosDb = await prisma.servicio.findMany({ where: { id: { in: idsUnicos } } });
        duracionFinal = finalServicioIds.reduce((sum: number, sid: string) => {
          const sDb = serviciosDb.find(s => s.id === sid);
          return sum + (sDb?.duracion || 30);
        }, 0);
      }

      const permitirHorarioExtendido = userRole === 'ADMIN' || userRole === 'EMPLEADO' || userRole === 'TECH_SUPPORT';

      const { calcularDisponibilidad, validarHoraExacta } = await import('@/lib/disponibilidad');
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

      if (disponibilidad.jornada && !esForzado) {
        // Solo validar colisiones si NO se está forzando
        const validacion = validarHoraExacta(
          horaFinal,
          duracionFinal,
          disponibilidad.jornada.inicio,
          disponibilidad.jornada.fin,
          disponibilidad.intervalosOcupados,
          permitirHorarioExtendido,
          disponibilidad.turnosEmpleado
        );

        if (!validacion.valida) {
          return NextResponse.json({ error: 'Hora no disponible: ' + validacion.motivo }, { status: 400 });
        }
      }
    }

    // Cita original ya cargada y validada arriba

    // ─── TRANSACCIÓN ────────────────────────────────────────────────────────
    const cita = await prisma.$transaction(async (tx) => {
      let serviciosParaActualizar: { id: string; duracion: number; precio: number }[] = [];
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
            precio:   parseCurrencyCRC(sDb.precio),
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
            precio:   parseCurrencyCRC(sDb.precio),
          };
        });
      }

      if (flagActualizarServicios && serviciosParaActualizar.length > 0) {
        const duracionCalculada = serviciosParaActualizar.reduce((sum, s) => sum + s.duracion, 0);
        const primerServicioId  = serviciosParaActualizar[0].id;
        const montoCalculado    = calcularTotalCita(serviciosParaActualizar);

        dataToUpdate.servicio_id = primerServicioId;
        dataToUpdate.duracion    = duracionCalculada;
        dataToUpdate.monto       = montoCalculado;

        await tx.citaServicio.deleteMany({ where: { cita_id: id } });

        await tx.citaServicio.createMany({
          data: serviciosParaActualizar.map((s, index) => ({
            cita_id:     id,
            servicio_id: s.id,
            duracion:    s.duracion,
            orden:       index,
            precio:      s.precio,
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
      userEmail: req.headers.get('x-user-email'),
      entityType: 'Cita',
      entityId: id,
      entityName: cita.cliente_nombre,
      description: finalDesc,
      beforeData: citaOriginal,
      afterData: cita,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: { cambios: dataToUpdate, forzado: esForzado }
    });

    return NextResponse.json({ cita, mensaje: 'Cita actualizada exitosamente con sus servicios' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }   = await params;
    const userRole = req.headers.get('x-user-role');
    const userId   = req.headers.get('x-user-id');

    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden eliminar citas' }, { status: 403 });
    }

    const cita = await prisma.cita.findUnique({
      where: { id }
    });

    if (!cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }

    await prisma.cita.delete({ where: { id } });

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: 'APPOINTMENT_DELETED',
      module: 'CITAS',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail: req.headers.get('x-user-email'),
      entityType: 'Cita',
      entityId: id,
      entityName: cita.cliente_nombre,
      description: `Cita de ${cita.cliente_nombre} eliminada permanentemente.`,
      beforeData: cita,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
    });

    return NextResponse.json({ mensaje: 'Cita eliminada' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
