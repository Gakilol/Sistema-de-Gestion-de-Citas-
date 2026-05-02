import { prisma } from '../lib/db';
import { CrearCitaSchema } from '../validadores';
import { z } from 'zod';
import { EstadoCita } from '@prisma/client';

export class CitaServicio {
  static async crearCita(clienteId: string, datos: z.infer<typeof CrearCitaSchema>) {
    const dataValidada = CrearCitaSchema.parse(datos);

    // 1. Validar que el servicio existe
    const servicio = await prisma.servicio.findUnique({
      where: { id: dataValidada.servicioId },
    });

    if (!servicio || !servicio.activo) {
      throw new Error('El servicio seleccionado no está disponible');
    }

    // Calcular horaFin basado en la duración del servicio
    const [hora, min] = dataValidada.horaInicio.split(':').map(Number);
    const fechaInicio = new Date();
    fechaInicio.setHours(hora, min, 0, 0);
    fechaInicio.setMinutes(fechaInicio.getMinutes() + servicio.duracionMinutos);
    const horaFin = `${String(fechaInicio.getHours()).padStart(2, '0')}:${String(fechaInicio.getMinutes()).padStart(2, '0')}`;

    // 2. Validar que el empleado tenga ese horario disponible
    // (Lógica simplificada para evitar doble reserva)
    const fechaReserva = new Date(dataValidada.fecha);
    
    const conflictoCita = await prisma.cita.findFirst({
      where: {
        empleadoId: dataValidada.empleadoId,
        fecha: fechaReserva,
        estado: { notIn: [EstadoCita.CANCELADA, EstadoCita.COMPLETADA, EstadoCita.NO_ASISTIO] },
        OR: [
          {
            horaInicio: { lte: dataValidada.horaInicio },
            horaFin: { gt: dataValidada.horaInicio },
          },
          {
            horaInicio: { lt: horaFin },
            horaFin: { gte: horaFin },
          },
        ],
      },
    });

    if (conflictoCita) {
      throw new Error('El profesional ya tiene una cita en ese horario');
    }

    // 3. Crear la cita
    const nuevaCita = await prisma.cita.create({
      data: {
        clienteId,
        empleadoId: dataValidada.empleadoId,
        servicioId: dataValidada.servicioId,
        fecha: fechaReserva,
        horaInicio: dataValidada.horaInicio,
        horaFin,
        notasCliente: dataValidada.notasCliente,
      },
      include: {
        servicio: true,
        empleado: { include: { usuario: { select: { nombre: true } } } },
      },
    });

    return nuevaCita;
  }

  static async obtenerCitasPorCliente(clienteId: string) {
    return await prisma.cita.findMany({
      where: { clienteId },
      include: {
        servicio: true,
        empleado: { include: { usuario: { select: { nombre: true } } } },
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    });
  }

  static async cancelarCita(clienteId: string, citaId: string) {
    const cita = await prisma.cita.findUnique({ where: { id: citaId } });

    if (!cita) throw new Error('Cita no encontrada');
    if (cita.clienteId !== clienteId) throw new Error('No autorizado para cancelar esta cita');
    if (cita.estado === EstadoCita.CANCELADA || cita.estado === EstadoCita.COMPLETADA) {
      throw new Error('La cita no puede ser cancelada en su estado actual');
    }

    return await prisma.cita.update({
      where: { id: citaId },
      data: { estado: EstadoCita.CANCELADA },
    });
  }
}
