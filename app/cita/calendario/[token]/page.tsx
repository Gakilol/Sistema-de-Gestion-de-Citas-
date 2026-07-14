// app/cita/calendario/[token]/page.tsx
// Página PÚBLICA para que el cliente agregue su cita al calendario.
// No requiere autenticación. Protegida por verificación HMAC en servidor.
// Nunca muestra: teléfono, IDs, notas internas, precios, botón editar/cancelar.

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { verificarTokenCalendario } from '@/lib/calendar-token';
import { prisma } from '@/lib/db';
import { formatDBDateLong } from '@/lib/timezone';
import { formatTo12h } from '@/lib/utils';
import CalendarioClienteUI from './CalendarioClienteUI';

export const metadata: Metadata = {
  title: 'Agregar cita al calendario — HAIR STYLE Salon & Barber',
  description: 'Agregue su cita en HAIR STYLE Salon & Barber a su calendario favorito.',
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

  // Calcular hora de fin
  const [h, m] = cita.hora.split(':').map(Number);
  const totalMin = h * 60 + m + cita.duracion;
  const hFin = Math.floor(totalMin / 60);
  const mFin = totalMin % 60;
  const horaFin = `${String(hFin).padStart(2, '0')}:${String(mFin).padStart(2, '0')}`;

  // Obtener servicios reales
  let servicios: string[] = [];
  if (cita.citaServicios && cita.citaServicios.length > 0) {
    servicios = cita.citaServicios
      .map((cs: any) => cs.servicio?.nombre)
      .filter(Boolean);
  } else if (cita.servicio?.nombre) {
    servicios = [cita.servicio.nombre];
  }

  // Obtener ubicación del negocio
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
    // Continuar sin ubicación
  }

  const fechaStr = cita.fecha.toISOString().split('T')[0];
  const fechaLegible = formatDBDateLong(cita.fecha);

  // Generar URL de Google Calendar
  const [year, month, day] = fechaStr.split('-');
  const [hStart, mStart] = cita.hora.split(':');
  const [hEnd, mEnd] = horaFin.split(':');
  const dtStart = `${year}${month}${day}T${hStart.padStart(2, '0')}${mStart.padStart(2, '0')}00`;
  const dtEnd = `${year}${month}${day}T${hEnd.padStart(2, '0')}${mEnd.padStart(2, '0')}00`;

  const gcalDetails: string[] = [
    `Profesional: ${cita.empleado?.nombre || 'Profesional'}`,
  ];
  if (servicios.length > 0) {
    gcalDetails.push(`Servicios: ${servicios.join(', ')}`);
  }
  gcalDetails.push('');
  gcalDetails.push('Recuerde presentarse 5 minutos antes de su cita.');

  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent('Cita en HAIR STYLE Salon & Barber')}` +
    `&dates=${dtStart}/${dtEnd}` +
    `&details=${encodeURIComponent(gcalDetails.join('\n'))}` +
    (ubicacion ? `&location=${encodeURIComponent(ubicacion)}` : '') +
    `&ctz=${encodeURIComponent('America/Costa_Rica')}`;

  // URL para descargar .ics
  const icsUrl = `/api/cita/calendario/${encodeURIComponent(decodedToken)}/ics`;

  return (
    <CalendarioClienteUI
      clienteNombre={cita.cliente_nombre}
      fechaLegible={fechaLegible}
      horaInicio={formatTo12h(cita.hora)}
      horaFin={formatTo12h(horaFin)}
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img
            src="/logo.png"
            alt="HAIR STYLE Salon & Barber"
            className="h-16 w-auto object-contain"
          />
        </div>

        {/* Error */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-lg space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{mensaje}</p>
        </div>

        <p className="text-xs text-muted-foreground/60">
          HAIR STYLE Salon & Barber
        </p>
      </div>
    </div>
  );
}
