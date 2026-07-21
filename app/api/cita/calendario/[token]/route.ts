// app/api/cita/calendario/[token]/route.ts
// Endpoint PÚBLICO para verificar un token de calendario y retornar datos de la cita.
// No requiere autenticación, pero valida el token HMAC en servidor.
// Nunca retorna IDs internos, teléfonos, notas ni datos sensibles.

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verificarTokenCalendario } from '@/lib/calendar-token';
import { formatDBDateLong } from '@/lib/timezone';
import { formatTo12h } from '@/lib/utils';
import { calcularFinCita } from '@/lib/calendar-event';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    // Decodificar el token de la URL
    const decodedToken = decodeURIComponent(token);

    // Verificar token HMAC
    const payload = verificarTokenCalendario(decodedToken);
    if (!payload) {
      return NextResponse.json(
        { error: 'El vínculo de esta cita no es válido o ha expirado.' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'El vínculo de esta cita no es válido o ha expirado.' },
        { status: 404 }
      );
    }

    // Validar que el token coincide con la versión actual de la cita
    const updatedAtStr = cita.updated_at.toISOString();
    if (payload.hora !== cita.hora || payload.updatedAt !== updatedAtStr) {
      return NextResponse.json(
        { error: 'El vínculo de esta cita no es válido o ha expirado.' },
        { status: 400 }
      );
    }

    // Validar estado
    if (cita.estado === 'CANCELADA') {
      return NextResponse.json(
        { error: 'Esta cita ya no se encuentra disponible.' },
        { status: 400 }
      );
    }

    const fechaStr = cita.fecha.toISOString().split('T')[0];
    const fin = calcularFinCita(fechaStr, cita.hora, cita.duracion);

    // Obtener servicios reales (solo si existen)
    let servicios: string[] = [];
    if (cita.citaServicios && cita.citaServicios.length > 0) {
      servicios = cita.citaServicios
        .map((cs: any) => cs.servicio?.nombre)
        .filter(Boolean);
    } else if (cita.servicio?.nombre) {
      servicios = [cita.servicio.nombre];
    }

    // Obtener ubicación del negocio si existe
    let ubicacion: string | null = null;
    try {
      const config = await prisma.configuracion.findUnique({ where: { id: 'default' } });
      if (config?.negocio && typeof config.negocio === 'object') {
        const negocio = config.negocio as any;
        if (negocio.direccion) {
          ubicacion = negocio.direccion;
        }
      }
    } catch {
      // Si no se puede obtener la configuración, continuar sin ubicación
    }

    // Formatear fecha
    const fechaLegible = formatDBDateLong(cita.fecha);

    // Retornar SOLO datos públicos seguros
    return NextResponse.json({
      clienteNombre: cita.cliente_nombre,
      fecha: fechaStr,
      fechaLegible,
      horaInicio: formatTo12h(cita.hora),
      horaFin: formatTo12h(fin.hora),
      horaInicioRaw: cita.hora,
      horaFinRaw: fin.hora,
      duracion: cita.duracion,
      profesional: cita.empleado?.nombre || '',
      servicios: servicios.length > 0 ? servicios : null,
      ubicacion,
      estado: cita.estado,
    });
  } catch (error: any) {
    console.error('[cita/calendario] Error verificando token');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
