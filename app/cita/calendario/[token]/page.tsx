// app/cita/calendario/[token]/page.tsx
// Página PÚBLICA para que el cliente agregue su cita al calendario.
// No requiere autenticación. Protegida por verificación HMAC en servidor.
// Nunca muestra: teléfono, IDs, notas internas, precios, botón editar/cancelar.

import { Metadata } from 'next';
import { verificarTokenCalendario } from '@/lib/calendar-token';
import { prisma } from '@/lib/db';
import { formatDBDateLong } from '@/lib/timezone';
import { formatTime12Hour } from '@/lib/time-utils';
import { buildGoogleCalendarUrl, calcularFinCita, isValidTimeZone } from '@/lib/calendar-event';
import CalendarioClienteUI from './CalendarioClienteUI';
import { ShieldAlert } from 'lucide-react';
import { BrandMark } from '@/components/shared/brand-mark';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Agregar cita al calendario — ${BRAND.businessName}`,
  description: `Agregue su cita en ${BRAND.businessName} a su calendario favorito.`,
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function CalendarioPublicoPage({ params }: PageProps) {
  const { token } = await params;
  const decodedToken = decodeURIComponent(token);

  // Verificar token HMAC en servidor
  const payload = verificarTokenCalendario(decodedToken);

  if (!payload) {
    return <ErrorPage mensaje="El vínculo de esta cita no es válido o ha expirado." />;
  }

  // Buscar la cita
  let cita;
  try {
    cita = await prisma.cita.findUnique({
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
  } catch {
    return <ErrorPage mensaje="Error interno del servidor." />;
  }

  if (!cita) {
    return <ErrorPage mensaje="El vínculo de esta cita no es válido o ha expirado." />;
  }

  // Validar que el token coincide con la versión actual de la cita
  const updatedAtStr = cita.updated_at.toISOString();
  if (payload.hora !== cita.hora || payload.updatedAt !== updatedAtStr) {
    return <ErrorPage mensaje="El vínculo de esta cita no es válido o ha expirado." />;
  }

  // Validar estado
  if (cita.estado === 'CANCELADA') {
    return <ErrorPage mensaje="Esta cita ya no se encuentra disponible." />;
  }

  const fechaStr = cita.fecha.toISOString().split('T')[0];
  const fin = calcularFinCita(fechaStr, cita.hora, cita.duracion);

  // Obtener servicios reales
  let servicios: string[] = [];
  if (cita.citaServicios && cita.citaServicios.length > 0) {
    servicios = cita.citaServicios
      .map((cs: { servicio: { nombre: string } | null }) => cs.servicio?.nombre)
      .filter(Boolean);
  } else if (cita.servicio?.nombre) {
    servicios = [cita.servicio.nombre];
  }

  // Obtener ubicación del negocio
  let ubicacion: string | null = null;
  let zonaHoraria = 'America/Costa_Rica';
  try {
    const config = await prisma.configuracion.findUnique({ where: { id: 'default' } });
    if (config?.negocio && typeof config.negocio === 'object') {
      const negocio = config.negocio as { direccion?: unknown; zona_horaria?: unknown };
        if (typeof negocio.direccion === 'string') {
          ubicacion = negocio.direccion;
        }
        if (typeof negocio.zona_horaria === 'string' && isValidTimeZone(negocio.zona_horaria)) {
          zonaHoraria = negocio.zona_horaria;
        }
    }
  } catch {
    // Continuar sin ubicación
  }

  const fechaLegible = formatDBDateLong(cita.fecha);

  const googleCalendarUrl = buildGoogleCalendarUrl({
    fecha: fechaStr,
    hora: cita.hora,
    duracion: cita.duracion,
    zonaHoraria,
    profesional: cita.empleado?.nombre || 'Profesional',
    servicios,
    ubicacion: ubicacion || undefined,
  });

  // URL para descargar .ics
  const icsUrl = `/api/cita/calendario/${encodeURIComponent(decodedToken)}/ics`;

  return (
    <CalendarioClienteUI
      clienteNombre={cita.cliente_nombre}
      fechaLegible={fechaLegible}
      horaInicio={formatTime12Hour(cita.hora)}
      horaFin={formatTime12Hour(fin.hora)}
      profesional={cita.empleado?.nombre || ''}
      servicios={servicios.length > 0 ? servicios : null}
      ubicacion={ubicacion}
      googleCalendarUrl={googleCalendarUrl}
      icsUrl={icsUrl}
      estado={cita.estado}
    />
  );
}

function ErrorPage({ mensaje }: { mensaje: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-5">
      <div className="w-full max-w-md">
        <BrandMark className="mb-8 justify-center" />
        <div className="surface-panel p-7 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-destructive">Vínculo no disponible</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground">No pudimos abrir esta cita.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{mensaje}</p>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Si necesitas ayuda, comunícate directamente con {BRAND.businessName}.
        </p>
      </div>
    </main>
  );
}
