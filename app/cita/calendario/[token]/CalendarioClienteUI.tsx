// app/cita/calendario/[token]/CalendarioClienteUI.tsx
// Componente CLIENT del lado público para mostrar los detalles de la cita
// y los botones de Google Calendar / descargar .ics.
// No muestra: teléfono, IDs, notas, precios, botón editar/cancelar.
// Responsive desde 320px. Botones táctiles grandes. Safe areas iPhone.

'use client';

import { CalendarPlus, Download, Clock, User, CalendarDays, Scissors, MapPin } from 'lucide-react';

interface CalendarioClienteUIProps {
  clienteNombre: string;
  fechaLegible: string;
  horaInicio: string;
  horaFin: string;
  profesional: string;
  servicios: string[] | null;
  ubicacion: string | null;
  googleCalendarUrl: string;
  icsUrl: string;
  estado: string;
}

export default function CalendarioClienteUI({
  clienteNombre,
  fechaLegible,
  horaInicio,
  horaFin,
  profesional,
  servicios,
  ubicacion,
  googleCalendarUrl,
  icsUrl,
  estado,
}: CalendarioClienteUIProps) {
  const isCompletada = estado === 'COMPLETADA';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-4 py-8 pt-safe pb-safe">
      <div className="w-full max-w-sm space-y-6">

        {/* ── Logo y Título ── */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="HAIR STYLE Salon & Barber"
              className="h-16 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Agregar cita al calendario
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              HAIR STYLE Salon & Barber
            </p>
          </div>
        </div>

        {/* ── Datos de la Cita ── */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-lg overflow-hidden">

          {/* Encabezado con nombre del cliente */}
          <div className="p-4 sm:p-5 border-b border-border/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cliente</p>
                <p className="text-base font-bold text-foreground">{clienteNombre}</p>
              </div>
            </div>
          </div>

          {/* Detalles */}
          <div className="p-4 sm:p-5 space-y-3.5">

            {/* Fecha */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <CalendarDays className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fecha</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{fechaLegible}</p>
              </div>
            </div>

            {/* Hora */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horario</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {horaInicio} – {horaFin}
                </p>
              </div>
            </div>

            {/* Profesional */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Scissors className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Profesional</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{profesional}</p>
              </div>
            </div>

            {/* Servicios (solo si existen) */}
            {servicios && servicios.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Scissors className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Servicios</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {servicios.map((nombre, i) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-lg bg-secondary/30 text-foreground border border-border/30 font-medium"
                      >
                        {nombre}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Ubicación (solo si existe) */}
            {ubicacion && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ubicación</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{ubicacion}</p>
                </div>
              </div>
            )}
          </div>

          {/* Mensaje de 5 minutos */}
          <div className="px-4 sm:px-5 pb-4 sm:pb-5">
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-center">
              <p className="text-xs text-foreground/80 font-medium">
                ⏰ Le agradecemos presentarse <strong>5 minutos antes</strong> de su cita.
              </p>
            </div>
          </div>
        </div>

        {/* ── Botones de Calendario ── */}
        <div className="space-y-2.5">
          {/* Google Calendar */}
          <a
            href={googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #4285F4 0%, #3367D6 100%)',
              boxShadow: '0 4px 14px rgba(66, 133, 244, 0.3)',
            }}
          >
            <CalendarPlus className="w-5 h-5" />
            Agregar a Google Calendar
          </a>

          {/* Descargar .ics */}
          <a
            href={icsUrl}
            download="cita-hair-style.ics"
            className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl font-bold text-sm bg-card border border-border/50 text-foreground shadow-sm hover:bg-secondary/30 transition-all active:scale-[0.98]"
          >
            <Download className="w-5 h-5" />
            Descargar para otro calendario
          </a>

          {isCompletada && (
            <p className="text-center text-[10px] text-muted-foreground/60 mt-1">
              Esta cita ya fue completada. Puede guardarla como referencia.
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-2 pb-4">
          <p className="text-[10px] text-muted-foreground/50">
            © HAIR STYLE Salon & Barber
          </p>
        </div>
      </div>
    </div>
  );
}
