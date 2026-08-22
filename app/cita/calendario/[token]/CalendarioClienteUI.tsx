'use client';

import type { ReactNode } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Download,
  MapPin,
  Scissors,
  UserRound,
} from 'lucide-react';
import { BrandMark } from '@/components/shared/brand-mark';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/brand';

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

interface DetailRowProps {
  icon: typeof CalendarDays;
  label: string;
  children: ReactNode;
}

function DetailRow({ icon: Icon, label, children }: DetailRowProps) {
  return (
    <div className="flex gap-3 border-t border-border/65 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-secondary/55 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
        <div className="mt-1 text-sm font-medium leading-5 text-foreground">{children}</div>
      </div>
    </div>
  );
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
    <main className="min-h-dvh bg-background px-4 py-6 pb-safe pt-safe sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between border-b border-border/70 pb-5">
          <BrandMark />
          <p className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:block">
            Invitación de calendario
          </p>
        </header>

        <section className="py-8 sm:py-12">
          <div className="mb-7 max-w-xl border-l-2 border-primary pl-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tu cita está lista</p>
            <h1 className="mt-2 font-display text-4xl leading-none tracking-tight text-foreground sm:text-5xl">
              Guarda la fecha.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Hola, {clienteNombre}. Agrega esta cita a tu calendario para tener los detalles siempre a mano.
            </p>
          </div>

          <div className="surface-panel overflow-hidden">
            <div className="grid sm:grid-cols-[13rem_1fr]">
              <div className="flex flex-col justify-between border-b border-primary/25 bg-primary/8 p-6 sm:border-b-0 sm:border-r">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary">Fecha reservada</p>
                  <p className="mt-3 font-display text-3xl leading-tight text-foreground">{fechaLegible}</p>
                </div>
                <div className="mt-8 border-t border-primary/20 pt-5">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{horaInicio}</p>
                  <p className="mt-1 text-xs text-muted-foreground">hasta las {horaFin}</p>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <DetailRow icon={UserRound} label="A nombre de">{clienteNombre}</DetailRow>
                <DetailRow icon={Scissors} label="Profesional">{profesional || 'Equipo de atención'}</DetailRow>
                {servicios && servicios.length > 0 && (
                  <DetailRow icon={CalendarDays} label="Servicios">
                    <div className="flex flex-wrap gap-1.5">
                      {servicios.map((nombre) => (
                        <span key={nombre} className="rounded-md border border-border/70 bg-secondary/45 px-2 py-1 text-xs">
                          {nombre}
                        </span>
                      ))}
                    </div>
                  </DetailRow>
                )}
                {ubicacion && <DetailRow icon={MapPin} label="Ubicación">{ubicacion}</DetailRow>}
                <DetailRow icon={Clock} label="Recomendación">
                  Preséntate 5 minutos antes para comenzar a tiempo.
                </DetailRow>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button asChild size="lg" className="h-12">
              <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
                <CalendarPlus className="size-4.5" aria-hidden="true" />
                Agregar a Google Calendar
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12">
              <a href={icsUrl} download="cita-novacita.ics">
                <Download className="size-4.5" aria-hidden="true" />
                Descargar otro calendario
              </a>
            </Button>
          </div>

          {isCompletada && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Esta cita ya fue completada; puedes guardarla como referencia.
            </p>
          )}
        </section>

        <footer className="border-t border-border/70 py-5 text-center text-xs text-muted-foreground">
          {BRAND.businessName} · {BRAND.descriptor}
        </footer>
      </div>
    </main>
  );
}
