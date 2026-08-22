import type { ReactNode } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { BrandMark } from '@/components/shared/brand-mark';

interface AuthShellProps {
  children: ReactNode;
  asideTitle?: string;
  asideDescription?: string;
}

const benefits = [
  'Agenda y equipo en un mismo lugar',
  'Seguimiento claro de cada cliente',
  'Operación diaria sin cruces de horario',
];

export function AuthShell({
  children,
  asideTitle = 'Tu agenda, con criterio.',
  asideDescription = 'Una forma más clara de organizar citas, clientes y equipo sin perder el trato personal.',
}: AuthShellProps) {
  return (
    <main className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.88fr)]">
      <section className="flex min-h-dvh flex-col px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
        <BrandMark className="mx-auto w-full max-w-md" />

        <div className="mx-auto flex w-full max-w-md flex-1 items-center py-10">
          <div className="w-full">{children}</div>
        </div>

        <p className="mx-auto w-full max-w-md text-xs text-muted-foreground">
          © {new Date().getFullYear()} {BRAND.productName} · Acceso reservado al equipo
        </p>
      </section>

      <aside className="relative hidden min-h-dvh overflow-hidden border-l border-border/70 bg-secondary/45 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-y-0 left-0 w-px bg-primary/45" aria-hidden="true" />
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <span className="h-px w-8 bg-primary" />
          Gestión de citas
        </div>

        <div className="max-w-lg py-16">
          <h1 className="font-display text-5xl leading-[0.98] tracking-[-0.04em] text-foreground xl:text-6xl">
            {asideTitle}
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
            {asideDescription}
          </p>

          <div className="mt-10 space-y-3 border-t border-border/70 pt-6">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 text-sm text-foreground/80">
                <span className="flex size-6 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {benefit}
              </div>
            ))}
          </div>
        </div>

        <div className="surface-panel max-w-md overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Próxima atención</p>
          </div>
          <div className="grid grid-cols-[4.5rem_1fr]">
            <div className="border-r border-primary/25 bg-primary/8 px-4 py-5 text-center">
              <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-primary">Hoy</p>
              <p className="font-display text-3xl leading-tight text-foreground">10:30</p>
            </div>
            <div className="px-5 py-5">
              <p className="font-semibold text-foreground">Servicio confirmado</p>
              <p className="mt-1 text-sm text-muted-foreground">El equipo tiene toda la información lista.</p>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
