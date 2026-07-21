// app/api/cita/calendario/[token]/ics/route.ts
// Endpoint PÚBLICO que genera y sirve un archivo .ics (iCalendar).
// Verifica el token HMAC antes de generar el archivo.
// Compatible con Apple Calendar, Outlook y calendarios Android.

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verificarTokenCalendario } from '@/lib/calendar-token';
import { generarICS } from '@/lib/ics';
import { isValidTimeZone } from '@/lib/calendar-event';

const DEFAULT_CALENDAR_TIMEZONE = 'America/Costa_Rica';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const decodedToken = decodeURIComponent(token);

    // Verificar token HMAC
    const payload = verificarTokenCalendario(decodedToken);
    if (!payload) {
      return new NextResponse('El vínculo de esta cita no es válido o ha expirado.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Buscar la cita
    const cita = await prisma.cita.findUnique({
      where: { id: payload.citaId },
      include: {
        empleado: { select: { nombre: true } },
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
      return new NextResponse('El vínculo de esta cita no es válido o ha expirado.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Validar versión
    const updatedAtStr = cita.updated_at.toISOString();
    if (payload.hora !== cita.hora || payload.updatedAt !== updatedAtStr) {
      return new NextResponse('El vínculo de esta cita no es válido o ha expirado.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Validar estado
    if (cita.estado === 'CANCELADA') {
      return new NextResponse('Esta cita ya no se encuentra disponible.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Obtener servicios
    let servicios: string[] = [];
    if (cita.citaServicios && cita.citaServicios.length > 0) {
      servicios = cita.citaServicios
        .map((cs: any) => cs.servicio?.nombre)
        .filter(Boolean);
    } else if (cita.servicio?.nombre) {
      servicios = [cita.servicio.nombre];
    }

    // Obtener ubicación del negocio
    let ubicacion: string | undefined;
    let zonaHoraria = DEFAULT_CALENDAR_TIMEZONE;
    try {
      const config = await prisma.configuracion.findUnique({ where: { id: 'default' } });
      if (config?.negocio && typeof config.negocio === 'object') {
        const negocio = config.negocio as any;
        if (negocio.direccion) {
          ubicacion = negocio.direccion;
        }
        if (isValidTimeZone(negocio.zona_horaria)) {
          zonaHoraria = negocio.zona_horaria;
        }
      }
    } catch {
      // Continuar sin ubicación
    }

    const fechaStr = cita.fecha.toISOString().split('T')[0];

    // Generar archivo .ics
    const icsContent = generarICS({
      citaId: cita.id,
      clienteNombre: cita.cliente_nombre,
      fecha: fechaStr,
      hora: cita.hora,
      duracion: cita.duracion,
      profesional: cita.empleado?.nombre || 'Profesional',
      servicios: servicios.length > 0 ? servicios : undefined,
      ubicacion,
      zonaHoraria,
    });

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="cita-hair-style.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[cita/calendario/ics] Error generando archivo ICS');
    return new NextResponse('Error interno del servidor', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
