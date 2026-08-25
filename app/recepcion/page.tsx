'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Accessibility, CalendarPlus, CheckCircle2, Clock3, ListPlus, Loader2,
  MessageCircle, Phone, Play, RefreshCcw, Search, UserPlus, Users, X,
} from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useAppointmentStatusSync } from '@/lib/appointments/use-appointment-status-sync';
import { APPOINTMENT_STATUS_BADGE_CLASSES, APPOINTMENT_STATUS_LABELS } from '@/lib/appointments/appointment-status';
import { formatTime12Hour } from '@/lib/time-utils';
import { cn } from '@/lib/utils';
import { urlWhatsAppEspacioDisponible, urlWhatsAppRecordatorio } from '@/lib/whatsapp';
import { toast } from 'sonner';

interface ReceptionAppointment {
  id: string;
  cliente_nombre: string;
  cliente_telefono?: string | null;
  fecha: string;
  hora: string;
  duracion: number;
  estado: string;
  servicio: { nombre: string };
  empleado: { nombre: string };
}

interface CatalogItem { id: string; nombre: string; duracion?: number }
interface WaitlistEntry {
  id: string;
  estado: 'ESPERANDO' | 'CONTACTADO' | 'AGENDADO' | 'CANCELADO';
  prioridad: number;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  jornadaPreferida?: string | null;
  notas?: string | null;
  cliente: { id: string; nombre: string; telefono?: string | null };
  servicio?: CatalogItem | null;
  profesional?: CatalogItem | null;
}

const waitlistInitial = {
  clienteId: '', servicioId: '', empleadoId: '', fechaDesde: '', fechaHasta: '',
  jornadaPreferida: 'CUALQUIERA', notas: '', prioridad: 0,
};

function getNextAction(appointment: ReceptionAppointment) {
  if (['PENDIENTE', 'CONFIRMADA', 'REPROGRAMADA'].includes(appointment.estado)) return { estado: 'EN_PROGRESO', label: 'Iniciar atención', icon: Play };
  if (appointment.estado === 'EN_PROGRESO') return { estado: 'COMPLETADA', label: 'Marcar completada', icon: CheckCircle2 };
  return null;
}

export default function ReceptionPage() {
  const [appointments, setAppointments] = useState<ReceptionAppointment[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [clients, setClients] = useState<CatalogItem[]>([]);
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [employees, setEmployees] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistForm, setWaitlistForm] = useState(waitlistInitial);
  const [savingWaitlist, setSavingWaitlist] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [dashboardRes, waitlistRes, clientsRes, servicesRes, employeesRes] = await Promise.all([
        authFetch('/api/dashboard'),
        authFetch('/api/lista-espera?estado=ESPERANDO&limit=30'),
        authFetch('/api/clientes?limit=50&orden=nombre'),
        authFetch('/api/servicios'),
        authFetch('/api/empleados?schedulable=true'),
      ]);
      if (!dashboardRes.ok || !waitlistRes.ok) throw new Error('No se pudo abrir el modo recepción.');
      const [dashboard, waitlistData, clientsData, servicesData, employeesData] = await Promise.all([
        dashboardRes.json(), waitlistRes.json(), clientsRes.json(), servicesRes.json(), employeesRes.json(),
      ]);
      setAppointments(dashboard.citasHoy ?? []);
      setWaitlist(waitlistData.entradas ?? []);
      setClients((clientsData.clientes ?? []).map((item: CatalogItem) => ({ id: item.id, nombre: item.nombre })));
      setServices((servicesData.servicios ?? []).filter((item: { activo?: boolean }) => item.activo !== false));
      setEmployees((employeesData.empleados ?? []).map((item: CatalogItem) => ({ id: item.id, nombre: item.nombre })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar recepción');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useAppointmentStatusSync(true, () => void load(true));

  const filteredAppointments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    if (!normalized) return appointments;
    return appointments.filter((item) => [item.cliente_nombre, item.cliente_telefono, item.servicio?.nombre, item.empleado?.nombre].some((value) => value?.toLocaleLowerCase('es').includes(normalized)));
  }, [appointments, query]);

  const updateAppointmentStatus = async (appointment: ReceptionAppointment, estado: string) => {
    const label = APPOINTMENT_STATUS_LABELS[estado] ?? estado;
    if (!window.confirm(`¿Cambiar la cita de ${appointment.cliente_nombre} a “${label}”?`)) return;
    setBusyId(appointment.id);
    try {
      const res = await authFetch(`/api/citas/${appointment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar la cita');
      setAppointments((current) => current.map((item) => item.id === appointment.id ? { ...item, estado } : item));
      toast.success(`Cita de ${appointment.cliente_nombre}: ${label}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar la cita');
    } finally { setBusyId(null); }
  };

  const sendReminder = (appointment: ReceptionAppointment) => {
    const url = urlWhatsAppRecordatorio({
      cliente_nombre: appointment.cliente_nombre, cliente_telefono: appointment.cliente_telefono,
      servicio: appointment.servicio.nombre, empleado: appointment.empleado.nombre,
      fecha: appointment.fecha, hora: appointment.hora, duracion: appointment.duracion,
    });
    if (!url) return toast.error('Este cliente no tiene teléfono para WhatsApp.');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const saveWaitlist = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingWaitlist(true);
    try {
      const payload = {
        ...waitlistForm,
        servicioId: waitlistForm.servicioId || null,
        empleadoId: waitlistForm.empleadoId || null,
        fechaDesde: waitlistForm.fechaDesde || null,
        fechaHasta: waitlistForm.fechaHasta || null,
        notas: waitlistForm.notas || null,
      };
      const res = await authFetch('/api/lista-espera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo agregar a la lista');
      setShowWaitlistForm(false); setWaitlistForm(waitlistInitial); toast.success('Cliente agregado a la lista de espera');
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo agregar a la lista');
    } finally { setSavingWaitlist(false); }
  };

  const contactWaitlist = async (entry: WaitlistEntry) => {
    const url = urlWhatsAppEspacioDisponible({ cliente_nombre: entry.cliente.nombre, cliente_telefono: entry.cliente.telefono, servicio: entry.servicio?.nombre });
    if (!url) return toast.error('Este cliente no tiene teléfono para WhatsApp.');
    window.open(url, '_blank', 'noopener,noreferrer');
    const res = await authFetch(`/api/lista-espera/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'CONTACTADO' }) });
    if (res.ok) setWaitlist((current) => current.filter((item) => item.id !== entry.id));
  };

  const taskCards = [
    { title: 'Crear una cita', detail: 'Formulario guiado', href: '/citas?nueva=1', icon: CalendarPlus, primary: true },
    { title: 'Registrar cliente', detail: 'Nombre y contacto', href: '/clientes?nuevo=1', icon: UserPlus },
    { title: 'Buscar cliente', detail: 'Historial y preferencias', href: '/clientes', icon: Users },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pb-24 pt-16 lg:pb-8 lg:pt-0">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-primary"><Accessibility className="size-5" /> Modo de atención fácil</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground sm:text-4xl">Recepción</h1>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">Botones grandes, instrucciones cortas y solo las tareas necesarias para atender el mostrador.</p>
            </div>
            <Button variant="outline" className="min-h-12 gap-2 px-5 text-base" onClick={() => void load(true)} disabled={refreshing}><RefreshCcw className={cn('size-5', refreshing && 'animate-spin')} /> Actualizar</Button>
          </header>

          <section aria-labelledby="reception-actions-title">
            <h2 id="reception-actions-title" className="mb-3 text-xl font-black text-foreground">¿Qué necesitas hacer?</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {taskCards.map(({ title, detail, href, icon: Icon, primary }) => (
                <Link key={title} href={href} className={cn('group flex min-h-36 items-center gap-4 rounded-2xl border p-5 transition-[transform,border-color,box-shadow] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25', primary ? 'border-primary bg-primary text-primary-foreground shadow-md sm:col-span-2 lg:col-span-1' : 'border-border bg-card text-foreground shadow-sm hover:border-primary/40')}>
                  <span className={cn('flex size-14 shrink-0 items-center justify-center rounded-xl', primary ? 'bg-black/15' : 'bg-primary/10 text-primary')}><Icon className="size-7" /></span>
                  <span><span className="block text-lg font-black">{title}</span><span className={cn('mt-1 block text-sm', primary ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{detail}</span></span>
                </Link>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="today-reception-title">
            <div className="space-y-3 border-b border-border p-4 sm:flex sm:items-end sm:justify-between sm:space-y-0 sm:p-5">
              <div><p className="text-sm font-bold text-primary">Agenda operativa</p><h2 id="today-reception-title" className="mt-1 text-2xl font-black text-foreground">Citas de hoy</h2></div>
              <label className="relative block w-full sm:max-w-sm"><Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente o servicio…" className="min-h-12 pl-11 text-base" /></label>
            </div>
            {loading ? <div className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground"><Loader2 className="size-6 animate-spin" /> Cargando citas…</div> : filteredAppointments.length === 0 ? <div className="p-10 text-center"><Clock3 className="mx-auto size-10 text-primary" /><p className="mt-3 text-lg font-bold text-foreground">No hay citas que mostrar</p></div> : (
              <div className="divide-y divide-border/70">
                {filteredAppointments.map((appointment) => {
                  const action = getNextAction(appointment); const ActionIcon = action?.icon;
                  return <article key={appointment.id} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[7rem_minmax(0,1fr)_auto] lg:items-center">
                    <div className="flex min-h-16 items-center justify-center rounded-xl bg-primary/10 px-3 text-xl font-black tabular-nums text-primary">{formatTime12Hour(appointment.hora)}</div>
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black text-foreground">{appointment.cliente_nombre}</h3><span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', APPOINTMENT_STATUS_BADGE_CLASSES[appointment.estado])}>{APPOINTMENT_STATUS_LABELS[appointment.estado] ?? appointment.estado}</span></div><p className="mt-1 text-base text-muted-foreground">{appointment.servicio?.nombre} · {appointment.empleado?.nombre} · {appointment.duracion} min</p></div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:flex">
                      {appointment.cliente_telefono && <Button variant="outline" className="min-h-12 gap-2 px-4 text-base" onClick={() => sendReminder(appointment)}><MessageCircle className="size-5 text-[#24865A]" /> Recordar</Button>}
                      {action && ActionIcon && <Button className="min-h-12 gap-2 px-5 text-base" disabled={busyId === appointment.id} onClick={() => void updateAppointmentStatus(appointment, action.estado)}>{busyId === appointment.id ? <Loader2 className="size-5 animate-spin" /> : <ActionIcon className="size-5" />}{action.label}</Button>}
                    </div>
                  </article>;
                })}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="waitlist-title">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div><p className="text-sm font-bold text-primary">Para llenar cancelaciones</p><h2 id="waitlist-title" className="mt-1 text-2xl font-black text-foreground">Lista de espera</h2><p className="mt-1 text-sm text-muted-foreground">Contacta primero a quienes llevan más tiempo esperando.</p></div>
              <Button className="min-h-12 gap-2 px-5 text-base" onClick={() => setShowWaitlistForm(true)}><ListPlus className="size-5" /> Agregar a la lista</Button>
            </div>
            {waitlist.length === 0 ? <div className="p-8 text-center text-muted-foreground">No hay clientes esperando un espacio.</div> : <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">{waitlist.map((entry) => <article key={entry.id} className="rounded-xl border border-border bg-background p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black text-foreground">{entry.cliente.nombre}</h3><p className="mt-1 text-sm text-muted-foreground">{entry.servicio?.nombre ?? 'Cualquier servicio'}{entry.profesional?.nombre ? ` · ${entry.profesional.nombre}` : ''}</p></div>{entry.prioridad > 0 && <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">Prioridad</span>}</div><div className="mt-4 grid gap-2 sm:grid-cols-2"><Button variant="outline" className="min-h-12 gap-2 text-base" onClick={() => void contactWaitlist(entry)}><Phone className="size-5" /> Contactar</Button><Link href={`/citas?nueva=1&clienteId=${entry.cliente.id}${entry.servicio?.id ? `&servicioId=${entry.servicio.id}` : ''}`}><Button className="min-h-12 w-full gap-2 text-base"><CalendarPlus className="size-5" /> Agendar</Button></Link></div></article>)}</div>}
          </section>
        </div>
      </main>

      {showWaitlistForm && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="waitlist-form-title"><div className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-border bg-card p-5 pb-safe shadow-2xl sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 id="waitlist-form-title" className="text-2xl font-black text-foreground">Agregar a lista de espera</h2><p className="mt-1 text-sm text-muted-foreground">Indica lo indispensable. Las preferencias de horario son opcionales.</p></div><button type="button" onClick={() => setShowWaitlistForm(false)} className="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-secondary" aria-label="Cerrar"><X className="size-5" /></button></div><form onSubmit={saveWaitlist} className="mt-5 space-y-4"><label className="block space-y-2 text-sm font-bold text-foreground">Cliente *<select required value={waitlistForm.clienteId} onChange={(event) => setWaitlistForm((current) => ({ ...current, clienteId: event.target.value }))} className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base"><option value="">Selecciona un cliente</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-bold text-foreground">Servicio<select value={waitlistForm.servicioId} onChange={(event) => setWaitlistForm((current) => ({ ...current, servicioId: event.target.value }))} className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base"><option value="">Cualquier servicio</option>{services.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="block space-y-2 text-sm font-bold text-foreground">Profesional<select value={waitlistForm.empleadoId} onChange={(event) => setWaitlistForm((current) => ({ ...current, empleadoId: event.target.value }))} className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base"><option value="">Cualquiera</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-bold text-foreground">Desde<Input type="date" value={waitlistForm.fechaDesde} onChange={(event) => setWaitlistForm((current) => ({ ...current, fechaDesde: event.target.value }))} className="min-h-12 text-base" /></label><label className="block space-y-2 text-sm font-bold text-foreground">Hasta<Input type="date" value={waitlistForm.fechaHasta} onChange={(event) => setWaitlistForm((current) => ({ ...current, fechaHasta: event.target.value }))} className="min-h-12 text-base" /></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-bold text-foreground">Horario<select value={waitlistForm.jornadaPreferida} onChange={(event) => setWaitlistForm((current) => ({ ...current, jornadaPreferida: event.target.value }))} className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base"><option value="CUALQUIERA">Cualquier hora</option><option value="MANANA">Por la mañana</option><option value="TARDE">Por la tarde</option></select></label><label className="block space-y-2 text-sm font-bold text-foreground">Prioridad<select value={waitlistForm.prioridad} onChange={(event) => setWaitlistForm((current) => ({ ...current, prioridad: Number(event.target.value) }))} className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base"><option value={0}>Normal</option><option value={1}>Alta</option><option value={2}>Urgente</option></select></label></div><label className="block space-y-2 text-sm font-bold text-foreground">Notas<textarea rows={3} value={waitlistForm.notas} onChange={(event) => setWaitlistForm((current) => ({ ...current, notas: event.target.value }))} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-3 text-base" placeholder="Ej. Puede llegar con 20 minutos de aviso" /></label><div className="grid gap-2 pt-2 sm:grid-cols-2"><Button type="button" variant="outline" className="min-h-12 text-base" onClick={() => setShowWaitlistForm(false)}>Cancelar</Button><Button type="submit" className="min-h-12 text-base" disabled={savingWaitlist}>{savingWaitlist ? <><Loader2 className="animate-spin" /> Guardando…</> : 'Agregar a la lista'}</Button></div></form></div></div>}
    </div>
  );
}
