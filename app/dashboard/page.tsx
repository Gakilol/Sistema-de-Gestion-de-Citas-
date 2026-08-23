'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Bot, CalendarDays, CalendarPlus, CheckCircle2, ChevronRight, Clock3, RefreshCcw, UserPlus } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { authFetch } from '@/lib/api-client';
import { useAppointmentStatusSync } from '@/lib/appointments/use-appointment-status-sync';
import { APPOINTMENT_STATUS_BADGE_CLASSES, APPOINTMENT_STATUS_LABELS } from '@/lib/appointments/appointment-status';
import { formatTime12Hour } from '@/lib/time-utils';
import { cn } from '@/lib/utils';

interface DashboardAppointment {
  id: string;
  cliente_nombre: string;
  fecha: string;
  hora: string;
  estado: string;
  servicio?: { nombre?: string };
  empleado?: { nombre?: string };
}

interface DashboardData {
  stats: {
    totalCitas: number;
    citasHoy: number;
    citasPendientes: number;
    citasCompletadasMes: number;
    citasCompletadasHoy: number;
    empleadosActivos: number;
    tasaCompletadas: number;
  };
  upcomingAppointments: DashboardAppointment[];
  citasHoy: DashboardAppointment[];
}

const taskCards = [
  { title: 'Nueva cita', description: 'Abrir la agenda y elegir un horario.', href: '/citas?nueva=1', icon: CalendarPlus, primary: true },
  { title: 'Pedirlo a la IA', description: 'Dilo con tus palabras y sigue los pasos.', href: '/ia?prompt=Quiero%20crear%20una%20cita', icon: Bot },
  { title: 'Nuevo cliente', description: 'Registrar sus datos en el directorio.', href: '/clientes?nuevo=1', icon: UserPlus },
];

function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="min-w-0 flex-1 pb-20 pt-16 lg:pb-0 lg:pt-0">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <div className="skeleton h-9 w-64" />
          <div className="skeleton h-5 w-80 max-w-full" />
          <div className="grid gap-3 sm:grid-cols-3"><div className="skeleton h-44 rounded-2xl sm:col-span-2" /><div className="skeleton h-44 rounded-2xl" /></div>
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setIsLoading(true);
    try {
      const response = await authFetch(`/api/dashboard?t=${Date.now()}`);
      if (!response.ok) throw new Error('No se pudo cargar el inicio.');
      setData(await response.json());
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (user) void load(); }, [user, load]);
  useAppointmentStatusSync(Boolean(user), () => void load(true));

  if (isAuthLoading || isLoading) return <DashboardSkeleton />;

  const stats = data?.stats;
  const today = data?.citasHoy ?? [];
  const upcoming = data?.upcomingAppointments ?? [];
  const isAdmin = user?.rol === 'ADMIN' || user?.rol === 'TECH_SUPPORT';
  const completed = stats?.citasCompletadasHoy ?? 0;
  const totalToday = stats?.citasHoy ?? 0;
  const progress = totalToday > 0 ? Math.min(100, Math.round((completed / totalToday) * 100)) : 0;
  const firstName = user?.nombre?.split(' ')[0] ?? '';
  const longDate = new Date().toLocaleDateString('es-NI', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pb-20 pt-16 lg:pb-0 lg:pt-0">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="capitalize text-sm font-semibold text-primary">{longDate}</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-4xl">Hola, {firstName}</h1>
              <p className="mt-2 text-base text-muted-foreground">Empieza por una tarea. El sistema te guía en lo demás.</p>
            </div>
            <Button variant="outline" size="icon" className="size-11" onClick={() => void load(true)} disabled={refreshing} aria-label="Actualizar inicio">
              <RefreshCcw className={cn('size-4', refreshing && 'animate-spin')} />
            </Button>
          </header>

          <section aria-labelledby="tasks-heading">
            <h2 id="tasks-heading" className="mb-3 text-lg font-bold text-foreground">¿Qué necesitas hacer?</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {taskCards.map(({ title, description, href, icon: Icon, primary }) => (
                <Link key={title} href={href} className={cn('group flex min-h-40 flex-col rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25', primary ? 'border-primary bg-primary text-primary-foreground sm:col-span-2' : 'border-border bg-card text-foreground hover:border-primary/45')}>
                  <span className={cn('flex size-12 items-center justify-center rounded-xl', primary ? 'bg-black/15 text-primary-foreground' : 'bg-primary/12 text-primary')}><Icon className="size-6" /></span>
                  <span className="mt-auto flex items-center justify-between gap-3 pt-5 text-xl font-black">{title}<ArrowRight className="size-5 transition-transform group-hover:translate-x-1" /></span>
                  <span className={cn('mt-1 text-sm leading-5', primary ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{description}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="today-heading">
            <div className="border-b border-border p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-primary">Tu día de un vistazo</p>
                  <h2 id="today-heading" className="mt-0.5 text-xl font-black text-foreground">{totalToday === 0 ? 'Hoy no hay citas programadas' : `${totalToday} ${totalToday === 1 ? 'cita' : 'citas'} para hoy`}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{completed} completadas · {stats?.citasPendientes ?? 0} pendientes</p>
                </div>
                <Link href="/citas"><Button variant="outline" size="lg" className="min-h-11">Abrir agenda <ChevronRight /></Button></Link>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary" aria-label={`${progress}% de las citas de hoy completadas`}>
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {today.length > 0 ? (
              <div className="divide-y divide-border/70">
                {today.slice(0, 4).map((appointment) => (
                  <Link key={appointment.id} href="/citas" className="group flex min-h-[4.75rem] items-center gap-3 px-4 py-3 transition hover:bg-secondary/55 sm:px-5">
                    <span className="flex min-h-11 min-w-[4.75rem] shrink-0 items-center justify-center rounded-xl bg-primary/12 px-2 text-sm font-black tabular-nums text-primary">{formatTime12Hour(appointment.hora)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold text-foreground">{appointment.cliente_nombre}</span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">{appointment.servicio?.nombre ?? 'Servicio'}{appointment.empleado?.nombre ? ` · ${appointment.empleado.nombre}` : ''}</span>
                    </span>
                    <span className={cn('hidden rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex', APPOINTMENT_STATUS_BADGE_CLASSES[appointment.estado])}>{APPOINTMENT_STATUS_LABELS[appointment.estado] ?? appointment.estado}</span>
                    <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <CalendarDays className="size-10 text-primary" />
                <p className="mt-3 text-base font-bold text-foreground">La agenda está libre</p>
                <p className="mt-1 text-sm text-muted-foreground">Puedes aprovechar para crear la próxima cita.</p>
              </div>
            )}
          </section>

          {upcoming.length > 0 && (
            <section aria-labelledby="next-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="next-heading" className="text-lg font-bold text-foreground">Después de hoy</h2>
                <Link href="/citas" className="text-sm font-bold text-primary hover:underline">Ver todas</Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.slice(0, 3).map((appointment) => (
                  <Link key={appointment.id} href="/citas" className="flex min-h-28 items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/45">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Clock3 className="size-5" /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-foreground">{appointment.cliente_nombre}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{new Date(appointment.fecha).toLocaleDateString('es-NI', { day: 'numeric', month: 'short', timeZone: 'UTC' })} · {formatTime12Hour(appointment.hora)}</span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">{appointment.servicio?.nombre}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {isAdmin && (
            <details className="rounded-2xl border border-border bg-card">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 font-bold text-foreground sm:px-5">
                <BarChart3 className="size-5 text-primary" /> Ver resumen del negocio <ChevronRight className="ml-auto size-4 transition-transform [[open]>&]:rotate-90" />
              </summary>
              <div className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
                <div className="bg-card p-5"><CheckCircle2 className="size-5 text-emerald-600" /><p className="mt-3 text-2xl font-black text-foreground">{stats?.citasCompletadasMes ?? 0}</p><p className="text-sm text-muted-foreground">Citas completadas este mes</p></div>
                <div className="bg-card p-5"><CalendarDays className="size-5 text-primary" /><p className="mt-3 text-2xl font-black text-foreground">{stats?.totalCitas ?? 0}</p><p className="text-sm text-muted-foreground">Citas registradas</p></div>
                <div className="bg-card p-5"><UserPlus className="size-5 text-primary" /><p className="mt-3 text-2xl font-black text-foreground">{stats?.empleadosActivos ?? 0}</p><p className="text-sm text-muted-foreground">Profesionales activos</p></div>
              </div>
              <div className="border-t border-border p-4 sm:p-5"><Link href="/reportes"><Button variant="outline">Abrir reportes completos <ArrowRight /></Button></Link></div>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}
