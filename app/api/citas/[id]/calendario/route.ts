// Authenticated endpoint that prepares safe calendar and WhatsApp actions.
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { generarTokenCalendario } from '@/lib/calendar-token';
import { normalizarTelefono } from '@/lib/normalize-phone';
import { formatDBDateLong } from '@/lib/timezone';
import { formatTo12h } from '@/lib/utils';
import { buildGoogleCalendarUrl, calcularFinCita, isValidTimeZone } from '@/lib/calendar-event';

const DEFAULT_CALENDAR_TIMEZONE = 'America/Costa_Rica';

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
        empleado: { select: { id: true, nombre: true, tituloCliente: true } },
        citaServicios: {
          include: { servicio: { select: { nombre: true } } },
          orderBy: { orden: 'asc' },
        },
        servicio: { select: { nombre: true } },
      },
    });
    if (!cita) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    if (userRole === 'EMPLEADO' && cita.empleado_id !== userId) {
      return NextResponse.json({ error: 'No tienes permiso para esta cita' }, { status: 403 });
    }
    if (cita.estado === 'CANCELADA') {
      return NextResponse.json({ error: 'No se puede generar enlace para una cita cancelada' }, { status: 400 });
    }
    if (!cita.cliente_nombre || !cita.fecha || !cita.hora || !cita.empleado) {
      return NextResponse.json({ error: 'La cita no tiene datos válidos para calendario' }, { status: 400 });
    }

    const token = generarTokenCalendario({
      id: cita.id,
      hora: cita.hora,
      updated_at: cita.updated_at,
      fecha: cita.fecha,
      duracion: cita.duracion,
    });
    const baseUrl = process.env.FRONTEND_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const publicUrl = `${baseUrl}/cita/calendario/${encodeURIComponent(token)}`;
    const icsUrl = `${baseUrl}/api/cita/calendario/${encodeURIComponent(token)}/ics`;
    const fechaStr = cita.fecha.toISOString().split('T')[0];
    const fechaLegible = formatDBDateLong(cita.fecha);
    const horaInicio12h = formatTo12h(cita.hora);
    const fin = calcularFinCita(fechaStr, cita.hora, cita.duracion);
    const profesional = cita.empleado.nombre;
    const servicios = cita.citaServicios.length > 0
      ? cita.citaServicios.map((cs: { servicio?: { nombre?: string | null } | null }) => cs.servicio?.nombre).filter((nombre: string | null | undefined): nombre is string => Boolean(nombre))
      : cita.servicio?.nombre ? [cita.servicio.nombre] : [];
    const serviciosTexto = servicios.join(', ') || 'Servicio general';

    let zonaHoraria = DEFAULT_CALENDAR_TIMEZONE;
    let ubicacion: string | undefined;
    try {
      const config = await prisma.configuracion.findUnique({ where: { id: 'default' } });
      const negocio = config?.negocio && typeof config.negocio === 'object' ? config.negocio as Record<string, unknown> : {};
      const zonaConfigurada = typeof negocio.zona_horaria === 'string' ? negocio.zona_horaria : undefined;
      zonaHoraria = isValidTimeZone(zonaConfigurada) ? zonaConfigurada : DEFAULT_CALENDAR_TIMEZONE;
      ubicacion = typeof negocio.direccion === 'string' && negocio.direccion.trim() ? negocio.direccion.trim() : undefined;
    } catch {
      // El calendario sigue disponible aun si no se puede leer la configuración opcional.
    }
    const googleCalendarUrl = buildGoogleCalendarUrl({
      fecha: fechaStr,
      hora: cita.hora,
      duracion: cita.duracion,
      zonaHoraria,
      profesional,
      servicios,
      ubicacion,
      clienteNombre: cita.cliente_nombre,
      variante: 'interno',
    });

    const mensajeConfirmacion = [
      'HAIR STYLE Salon & Barber',
      '',
      `Hola ${cita.cliente_nombre},`,
      'Su cita ha sido confirmada con éxito.',
      '',
      `Fecha: ${fechaLegible}`,
      `Hora: ${horaInicio12h}`,
      `Servicio: ${serviciosTexto}`,
      '',
      'Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención.',
      '',
      'Agregar esta cita a tu calendario:',
      publicUrl,
    ].join('\n');
    const mensajeRecordatorio = [
      'HAIR STYLE Salon & Barber',
      '',
      `Hola ${cita.cliente_nombre}, le recordamos su próxima cita:`,
      '',
      `Fecha: ${fechaLegible}`,
      `Hora: ${horaInicio12h}`,
      `Servicio: ${serviciosTexto}`,
      '',
      'Le agradecemos presentarse 5 minutos antes de su cita para una mejor atención.',
    ].join('\n');
    const telefonoNormalizado = normalizarTelefono(cita.cliente_telefono);
    const waUrlConfirmacion = telefonoNormalizado
      ? `https://wa.me/${telefonoNormalizado}?text=${encodeURIComponent(mensajeConfirmacion)}`
      : null;
    const waUrlRecordatorio = telefonoNormalizado
      ? `https://wa.me/${telefonoNormalizado}?text=${encodeURIComponent(mensajeRecordatorio)}`
      : null;

    return NextResponse.json({
      token,
      url: publicUrl,
      icsUrl,
      googleCalendarUrl,
      zonaHoraria,
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
      horaFin: formatTo12h(fin.hora),
    });
  } catch {
    console.error('[calendario/route] Error generando token de calendario');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
