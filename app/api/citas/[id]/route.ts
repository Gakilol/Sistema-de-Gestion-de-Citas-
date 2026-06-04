import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { parseLocalDateToUTC } from '@/lib/timezone';
import { registrarAuditoria } from '@/lib/auditoria';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }   = await params;
    const body     = await req.json();
    const userRole = req.headers.get('x-user-role') || '';
    const userId   = req.headers.get('x-user-id');

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
    } = body;

    const dataToUpdate: any = {};
    if (estado)               dataToUpdate.estado      = estado;
    if (notas !== undefined)  dataToUpdate.notas       = notas;
    if (empleado_id)          dataToUpdate.empleado_id = empleado_id;
    if (fecha)                dataToUpdate.fecha       = parseLocalDateToUTC(fecha.split('T')[0]);
    if (hora)                 dataToUpdate.hora        = hora;
    if (servicio_id)          dataToUpdate.servicio_id = servicio_id;
    if (duracion !== undefined) dataToUpdate.duracion  = Number(duracion);

    // ─── GESTIÓN DE CLIENTE EN EDICIÓN ──────────────────────────────────────
    let idClienteFinal = cliente_id;
    if (cliente_nombre && !idClienteFinal) {
      const existe = await prisma.cliente.findFirst({
        where: {
          nombre: cliente_nombre.trim(),
          ...(cliente_telefono ? { telefono: cliente_telefono.trim() } : {})
        }
      });
      if (existe) {
        idClienteFinal = existe.id;
      } else {
        const nuevoC = await prisma.cliente.create({
          data: {
            nombre:   cliente_nombre.trim(),
            telefono: cliente_telefono?.trim() || null,
          }
        });
        idClienteFinal = nuevoC.id;
      }
    }

    if (idClienteFinal)             dataToUpdate.cliente_id       = idClienteFinal;
    if (cliente_nombre)             dataToUpdate.cliente_nombre   = cliente_nombre.trim();
    if (cliente_telefono !== undefined) dataToUpdate.cliente_telefono = cliente_telefono?.trim() || null;

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
          return {
            id:       sel.id,
            duracion: typeof sel.duracion === 'number' && sel.duracion > 0 ? sel.duracion : (sDb?.duracion || 30)
          };
        }).filter((s: any) => s.id);

      } else if (Array.isArray(finalServicioIds) && finalServicioIds.length > 0) {
        flagActualizarServicios = true;
        const idsUnicos   = [...new Set(finalServicioIds)] as string[];
        const serviciosDb = await tx.servicio.findMany({ where: { id: { in: idsUnicos } } });

        // Preservar duplicados usando el array original
        serviciosParaActualizar = finalServicioIds.map((sid: string, i: number) => {
          const sDb = serviciosDb.find(s => s.id === sid);
          return { id: sid, duracion: sDb?.duracion || 30 };
        }).filter((s: any) => s.id);
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

    await registrarAuditoria({
      entidad: 'Cita',
      entidadId: id,
      accion: esForzado ? 'FORZAR' : 'ACTUALIZAR',
      detalles: { cambios: dataToUpdate, forzado: esForzado },
      realizadoPor: userId,
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

    await prisma.cita.delete({ where: { id } });

    await registrarAuditoria({
      entidad: 'Cita',
      entidadId: id,
      accion: 'ELIMINAR',
      detalles: { eliminadoPor: userRole },
      realizadoPor: userId,
    });

    return NextResponse.json({ mensaje: 'Cita eliminada' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
