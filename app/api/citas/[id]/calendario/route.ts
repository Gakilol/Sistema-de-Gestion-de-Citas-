// app/api/citas/[id]/calendario/route.ts
// Endpoint AUTENTICADO para generar un token de calendario seguro.
// Solo accesible por usuarios autenticados con permisos sobre la cita.

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { generarTokenCalendario } from '@/lib/calendar-token';
import { normalizarTelefono } from '@/lib/normalize-phone';
import { formatDBDateLong } from '@/lib/timezone';
import { formatTo12h } from '@/lib/utils';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, userRole } = getUserContext(req);

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 401 });
    }

    // Obtener la cita con relaciones necesarias
    const cita = await prisma.cita.findUnique({
      where: { id },
      include: {
        empleado: { select: { id: true, nombre: true, tituloCliente: true } },
        citaServicios: {
          include: {
            servicio: { select: { nombre: true } }
          },
          orderBy: { orden: 'asc' }
        },
        servicio: { select: { nombre: true } },
      },
    });

    if (!cita) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }

    // Respetar permisos: EMPLEADO solo puede acceder a sus propias citas
    if (userRole === 'EMPLEADO' && cita.empleado_id !== userId) {
      return NextResponse.json({ error: 'No tienes permiso para esta cita' }, { status: 403 });
    }

    // Validar que no esté cancelada ni eliminada
    if (cita.estado === 'CANCELADA') {
      return NextResponse.json({ error: 'No se puede generar enlace para una cita cancelada' }, { status: 400 });
    }

    // Validar que exista cliente
    if (!cita.cliente_nombre) {
      return NextResponse.json({ error: 'La cita no tiene un cliente asignado' }, { status: 400 });
    }

    // Validar teléfono
    const telefonoNormalizado = normalizarTelefono(cita.cliente_telefono);
    if (!telefonoNormalizado) {
      return NextResponse.json(
        { error: 'Este cliente fue agendado solamente con nombre y no tiene teléfono registrado.' },
        { status: 400 }
      );
    }

    // Validar fechas
    if (!cita.fecha || !cita.hora) {
      return NextResponse.json({ error: 'La cita no tiene fecha u hora válida' }, { status: 400 });
    }

    // Validar profesional
    if (!cita.empleado) {
      return NextResponse.json({ error: 'La cita no tiene un profesional asignado' }, { status: 400 });
    }

    // Generar token
    const token = generarTokenCalendario({
      id: cita.id,
      hora: cita.hora,
      updated_at: cita.updated_at,
      fecha: cita.fecha,
      duracion: cita.duracion,
    });

    // Construir URL pública
    const baseUrl = process.env.FRONTEND_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const publicUrl = `${baseUrl}/cita/calendario/${encodeURIComponent(token)}`;

    // Formatear datos para el mensaje
    const fechaStr = typeof cita.fecha === 'string'
      ? cita.fecha.split('T')[0]
      : cita.fecha.toISOString().split('T')[0];
    const fechaLegible = formatDBDateLong(cita.fecha);
    const horaInicio12h = formatTo12h(cita.hora);
    
    // Calcular hora de fin
    const [h, m] = cita.hora.split(':').map(Number);
    const totalMin = h * 60 + m + cita.duracion;
    const hFin = Math.floor(totalMin / 60);
    const mFin = totalMin % 60;
    const horaFin = `${String(hFin).padStart(2, '0')}:${String(mFin).padStart(2, '0')}`;
    const horaFin12h = formatTo12h(horaFin);

    const profesional = cita.empleado.nombre;

    // Obtener servicios
    let serviciosTexto = '';
    if (cita.citaServicios && cita.citaServicios.length > 0) {
      serviciosTexto = cita.citaServicios.map((cs: any) => cs.servicio?.nombre).filter(Boolean).join(', ');
    } else if (cita.servicio?.nombre) {
      serviciosTexto = cita.servicio.nombre;
    }

    // 1. Mensaje de Confirmación (con enlace para guardar en Google Calendar)
    const mensajeConfirmacion = [
      `HAIR STYLE Salon & Barber`,
      ``,
      `Hola ${cita.cliente_nombre},`,
      `Su cita ha sido confirmada con éxito.`,
      ``,
      `Fecha: ${fechaLegible}`,
      `Hora: ${horaInicio12h}`,
      `Servicio: ${serviciosTexto || 'Servicio general'}`,
      ``,
      `Guarda tu cita en Google Calendar:`,
      publicUrl,
      ``,
      `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención.`,
    ].join('\n');

    // 2. Mensaje de Recordatorio
    const mensajeRecordatorio = [
      `HAIR STYLE Salon & Barber`,
      ``,
      `Hola ${cita.cliente_nombre}, le recordamos su próxima cita:`,
      ``,
      `Fecha: ${fechaLegible}`,
      `Hora: ${horaInicio12h}`,
      `Servicio: ${serviciosTexto || 'Servicio general'}`,
      ``,
      `Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención.`,
    ].join('\n');

    // Construir enlaces wa.me
    const waUrlConfirmacion = `https://wa.me/${telefonoNormalizado}?text=${encodeURIComponent(mensajeConfirmacion)}`;
    const waUrlRecordatorio = `https://wa.me/${telefonoNormalizado}?text=${encodeURIComponent(mensajeRecordatorio)}`;

    return NextResponse.json({
      token,
      url: publicUrl,
      mensaje: mensajeConfirmacion,
      mensajeConfirmacion,
      mensajeRecordatorio,
      waUrl: waUrlConfirmacion,
      waUrlConfirmacion,
      waUrlRecordatorio,
      clienteNombre: cita.cliente_nombre,
      profesional,
      fecha: fechaLegible,
      horaInicio: horaInicio12h,
      horaFin: horaFin12h,
    });
  } catch (error: any) {
    console.error('[calendario/route] Error generando token de calendario');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
