import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { parseLocalDateToUTC } from '@/lib/timezone';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { estado, notas, empleado_id, fecha, hora, servicio_id, servicio_ids, duracion, cliente_id, cliente_nombre, cliente_telefono } = body;

    const dataToUpdate: any = {};
    if (estado) dataToUpdate.estado = estado;
    if (notas !== undefined) dataToUpdate.notas = notas;
    if (empleado_id) dataToUpdate.empleado_id = empleado_id;
    if (fecha) dataToUpdate.fecha = parseLocalDateToUTC(fecha.split('T')[0]);
    if (hora) dataToUpdate.hora = hora;
    if (servicio_id) dataToUpdate.servicio_id = servicio_id;
    if (duracion !== undefined) dataToUpdate.duracion = Number(duracion);
    
    // GESTIÓN DE CLIENTE EN EDICIÓN
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
            nombre: cliente_nombre.trim(),
            telefono: cliente_telefono?.trim() || null,
          }
        });
        idClienteFinal = nuevoC.id;
      }
    }
    
    if (idClienteFinal) dataToUpdate.cliente_id = idClienteFinal;
    if (cliente_nombre) dataToUpdate.cliente_nombre = cliente_nombre.trim();
    if (cliente_telefono !== undefined) dataToUpdate.cliente_telefono = cliente_telefono?.trim() || null;

    // Resolver array de servicios para mantener sincronía
    let finalServicioIds = servicio_ids;
    if (!finalServicioIds && servicio_id) {
      finalServicioIds = [servicio_id];
    }

    // ─── VALIDACIÓN DE DISPONIBILIDAD AL EDITAR (Backend = fuente de verdad) ───
    // Si cambian hora, fecha, empleado o servicios, re-validar disponibilidad
    const cambiaHorario = hora || fecha || empleado_id || (Array.isArray(finalServicioIds) && finalServicioIds.length > 0);
    
    if (cambiaHorario) {
      const citaActual = await prisma.cita.findUnique({ where: { id } });
      if (!citaActual) {
        return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
      }

      const empleadoFinal = empleado_id || citaActual.empleado_id;
      const fechaFinal = fecha ? fecha.split('T')[0] : new Date(citaActual.fecha).toISOString().split('T')[0];
      const horaFinal = hora || citaActual.hora;

      // Calcular duración final
      let duracionFinal = citaActual.duracion;
      if (Array.isArray(finalServicioIds) && finalServicioIds.length > 0) {
        const serviciosDb = await prisma.servicio.findMany({
          where: { id: { in: finalServicioIds } }
        });
        duracionFinal = serviciosDb.reduce((sum, s) => sum + s.duracion, 0);
      }

      const userRole = req.headers.get('x-user-role') || '';
      const permitirHorarioExtendido = userRole === 'ADMIN' || userRole === 'EMPLEADO';

      const { calcularDisponibilidad, validarHoraExacta } = await import('@/lib/disponibilidad');
      const disponibilidad = await calcularDisponibilidad(
        empleadoFinal, 
        fechaFinal, 
        null, 
        duracionFinal, 
        horaFinal, 
        id, 
        permitirHorarioExtendido // excludeCitaId = id de la cita actual
      );

      if (!disponibilidad.disponible) {
        return NextResponse.json({ error: 'El empleado no está disponible este día: ' + disponibilidad.motivo }, { status: 400 });
      }

      if (disponibilidad.jornada) {
        const validacion = validarHoraExacta(
          horaFinal,
          duracionFinal,
          disponibilidad.jornada.inicio,
          disponibilidad.jornada.fin,
          disponibilidad.intervalosOcupados,
          permitirHorarioExtendido
        );

        if (!validacion.valida) {
          return NextResponse.json({ error: 'Hora no disponible: ' + validacion.motivo }, { status: 400 });
        }
      }
    }

    const cita = await prisma.$transaction(async (tx) => {
      if (Array.isArray(finalServicioIds) && finalServicioIds.length > 0) {
        const serviciosDb = await tx.servicio.findMany({
          where: { id: { in: finalServicioIds } }
        });

        // Mantener orden de la petición
        const serviciosDbOrdenados = finalServicioIds
          .map(sid => serviciosDb.find(s => s.id === sid))
          .filter((s): s is NonNullable<typeof s> => !!s);

        if (serviciosDbOrdenados.length > 0) {
          const duracionCalculada = serviciosDbOrdenados.reduce((sum, s) => sum + s.duracion, 0);
          const primerServicioId = serviciosDbOrdenados[0].id;

          dataToUpdate.servicio_id = primerServicioId;
          dataToUpdate.duracion = duracionCalculada;

          // Limpiar relaciones anteriores
          await tx.citaServicio.deleteMany({
            where: { cita_id: id }
          });

          // Insertar nuevas relaciones
          const newCitaServicios = serviciosDbOrdenados.map((s, index) => ({
            cita_id: id,
            servicio_id: s.id,
            duracion: s.duracion,
            orden: index
          }));

          await tx.citaServicio.createMany({
            data: newCitaServicios
          });
        }
      }

      // Actualizar la cita
      const c = await tx.cita.update({
        where: { id },
        data: dataToUpdate,
        include: {
          servicio: {
            select: {
              nombre: true,
              categoriaRel: {
                select: { nombre: true, color: true }
              }
            }
          },
          citaServicios: {
            include: {
              servicio: {
                select: { 
                  id: true, 
                  nombre: true, 
                  duracion: true,
                  categoriaRel: {
                    select: { nombre: true, color: true }
                  }
                }
              }
            },
            orderBy: { orden: 'asc' }
          }
        }
      });

      return c;
    });

    return NextResponse.json({ cita, mensaje: 'Cita actualizada exitosamente con sus servicios' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden eliminar citas' }, { status: 403 });
    }

    await prisma.cita.delete({ where: { id } });

    return NextResponse.json({ mensaje: 'Cita eliminada' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
