import type { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { BrandMark } from '@/components/shared/brand-mark';

interface AuthShellProps {
  children: ReactNode;
  asideTitle?: string;
  asideDescription?: string;
}

export function AuthShell({
  children,
  asideTitle = 'Tu agenda, con criterio.',
  asideDescription = 'Una forma más clara de organizar citas, clientes y equipo sin perder el trato personal.',
}: AuthShellProps) {
  return (
    <main className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(32rem,42rem)_minmax(0,1fr)]">
      <section className="flex min-h-dvh items-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-lg">
          <BrandMark className="mb-6 w-full" />
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
            {children}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} {BRAND.productName} · Acceso reservado al equipo
          </p>
        </div>
      </section>

      <aside className="relative hidden min-h-dvh overflow-hidden border-l border-border bg-secondary/50 px-12 lg:flex lg:items-center xl:px-20">
        <div className="absolute inset-y-0 left-0 w-px bg-primary/45" aria-hidden="true" />
        <div className="max-w-2xl">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-primary/35 bg-primary/10 text-primary">
            <CalendarDays className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-primary">Gestión de citas</p>
          <h1 className="mt-4 font-display text-5xl leading-[0.98] tracking-[-0.04em] text-foreground xl:text-6xl">
            {asideTitle}
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
            {asideDescription}
          </p>
          <div className="mt-10 flex items-center gap-4 border-t border-border pt-6 text-sm font-semibold text-foreground/75">
            <span>Agenda</span><span className="size-1 rounded-full bg-primary" /><span>Clientes</span><span className="size-1 rounded-full bg-primary" /><span>Equipo</span>
          </div>
        </div>
      </aside>
    </main>
  );
}
