import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { calcularDisponibilidad } from '@/lib/disponibilidad';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cliente_nombre, cliente_telefono, servicio_id, empleado_id, fecha, hora, notas } = body;

    // VALIDACIÓN BÁSICA DE CAMPOS
    if (!cliente_nombre || !servicio_id || !empleado_id || !fecha || !hora) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // OBTENER INFORMACIÓN DEL SERVICIO
    const servicio = await prisma.servicio.findUnique({
      where: { id: servicio_id },
    });

    if (!servicio || !servicio.activo) {
      return NextResponse.json({ error: 'Servicio no encontrado o inactivo' }, { status: 404 });
    }

    const duracion = servicio.duracion;

    // VALIDACIÓN DE DISPONIBILIDAD EN TIEMPO REAL
    // fecha debe venir en formato YYYY-MM-DD
    const fechaLimpia = fecha.split('T')[0];
    const disponibilidad = await calcularDisponibilidad(empleado_id, fechaLimpia, servicio_id);

    if (!disponibilidad.disponible) {
      return NextResponse.json({ error: 'El empleado no está disponible este día: ' + disponibilidad.motivo }, { status: 400 });
    }

    const bloqueSolicitado = disponibilidad.bloques.find((b: any) => b.hora === hora);
    if (!bloqueSolicitado) {
      return NextResponse.json({ error: 'La hora solicitada no está dentro del horario laboral' }, { status: 400 });
    }

    if (!bloqueSolicitado.disponible) {
      return NextResponse.json({ error: 'La hora seleccionada ya no está disponible: ' + bloqueSolicitado.motivo }, { status: 400 });
    }

    // GESTIÓN O BÚSQUEDA DE CLIENTE
    let idClienteFinal: string | null = null;
    
    // Buscar por teléfono si se proporciona
    if (cliente_telefono && cliente_telefono.trim()) {
      const existe = await prisma.cliente.findFirst({
        where: {
          telefono: cliente_telefono.trim(),
        },
      });
      if (existe) {
        idClienteFinal = existe.id;
      }
    }

    // Si no se encontró, buscar por nombre
    if (!idClienteFinal) {
      const existePorNombre = await prisma.cliente.findFirst({
        where: {
          nombre: cliente_nombre.trim(),
          ...(cliente_telefono ? { telefono: cliente_telefono.trim() } : {}),
        },
      });
      if (existePorNombre) {
        idClienteFinal = existePorNombre.id;
      }
    }

    // Si sigue sin existir, crear el registro del cliente
    if (!idClienteFinal) {
      const nuevoCliente = await prisma.cliente.create({
        data: {
          nombre: cliente_nombre.trim(),
          telefono: cliente_telefono?.trim() || null,
        },
      });
      idClienteFinal = nuevoCliente.id;
    }

    // CREACIÓN DE LA CITA
    // created_by se asocia al mismo empleado_id para mantener la integridad relacional de Prisma
    const cita = await prisma.cita.create({
      data: {
        cliente_id: idClienteFinal,
        cliente_nombre: cliente_nombre.trim(),
        cliente_telefono: cliente_telefono?.trim() || null,
        servicio_id,
        empleado_id,
        fecha: new Date(fechaLimpia + 'T00:00:00Z'), // Seteado a UTC para evitar desfases
        hora,
        duracion: Number(duracion),
        estado: 'PENDIENTE', // La cita de auto-agendamiento público queda PENDIENTE de aprobación
        notas: notas || 'Reserva automática realizada por el cliente desde el portal público',
        created_by: empleado_id,
      },
      include: {
        servicio: { select: { nombre: true } },
        empleado: { select: { nombre: true } },
      },
    });

    return NextResponse.json({
      success: true,
      cita,
      mensaje: 'Tu cita ha sido reservada con éxito y está pendiente de confirmación.',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error al procesar reserva pública:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
