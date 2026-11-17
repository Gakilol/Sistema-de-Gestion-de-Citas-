'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck2, Check, ChevronRight, Clock3, Loader2, Mic, Plus, Search, Send, ShieldCheck, Sparkles, Square, UserRound, X } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { useAuth } from '@/components/providers/auth-provider';
import { authFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDBDateLong } from '@/lib/timezone';
import { formatTime12Hour } from '@/lib/time-utils';
import { useDictation } from '@/lib/ia/use-dictation';
import type { AssistantReply, ClientOption, DraftView, EmployeeOption, ServiceOption } from '@/lib/ia/domain';

interface Message { role: 'user' | 'assistant'; text: string; result?: AssistantReply }
const welcome: Message = { role: 'assistant', text: 'Hola. Puedo consultar tu agenda, buscar horarios y preparar citas. Selecciona el cliente en pantalla y dime qué necesitas.' };
const fieldClass = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60';

export default function AssistantPage() {
  const { user, isLoading } = useAuth();
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [client, setClient] = useState<ClientOption | null>(null);
  const [clientQuery, setClientQuery] = useState('');
  const [matches, setMatches] = useState<ClientOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [createdId, setCreatedId] = useState('');
  const [now, setNow] = useState(Date.now());
  const bottom = useRef<HTMLDivElement>(null);
  const voicePrefix = useRef('');
  const request = useRef<AbortController | null>(null);
  const voice = useDictation(text => setInput(`${voicePrefix.current}${text}`.slice(0, 1500)));

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    authFetch('/api/ia/contexto', { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar el asistente.');
      setServices(data.servicios); setEmployees(data.empleados);
      if (user.rol === 'EMPLEADO') setEmployeeId(user.id);
    }).catch(error => { if (error.name !== 'AbortError') setUnavailable(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingCatalog(false); });
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (client || clientQuery.trim().length < 2) { setMatches([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await authFetch(`/api/ia/clientes?q=${encodeURIComponent(clientQuery.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo buscar el cliente.');
        setMatches(data.clientes);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Error de búsqueda.'); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [clientQuery, client]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, busy]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => { clearInterval(timer); request.current?.abort(); };
  }, []);

  async function send(text = input, selection?: { client?: ClientOption | null; employeeId?: string }) {
    if (!text.trim() || busy || unavailable) return;
    voice.cancel(); setBusy(true); setError(''); setInput(''); setCreatedId('');
    // A pending interpretation invalidates the visible confirmation immediately.
    setDraft(current => current ? { ...current, listo: false } : null);
    setMessages(current => [...current, { role: 'user', text: text.trim() }]);
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await authFetch('/api/ia/chat', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: text.trim(), clienteId: (selection && 'client' in selection ? selection.client : client)?.id ?? null,
          empleadoId: (selection?.employeeId ?? employeeId) || null, ...(draft ? { borradorId: draft.id, revision: draft.revision } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo procesar la consulta.');
      const result = data as AssistantReply;
      setMessages(current => [...current, { role: 'assistant', text: result.text, result }]);
      if (result.draft) { setDraft(result.draft); if (result.draft.empleadoId) setEmployeeId(result.draft.empleadoId); }
      else if (draft) setDraft({ ...draft, listo: selection ? false : draft.listo });
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'No se pudo conectar.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }

  async function confirm() {
    if (!draft?.listo || busy) return;
    setBusy(true); setError('');
    try {
      const response = await authFetch('/api/ia/citas/confirmar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ borradorId: draft.id, revision: draft.revision }) });
      const data = await response.json();
      if (!response.ok) {
        setDraft(data.draft ?? { ...draft, listo: false });
        throw new Error(data.error || 'No se pudo registrar la cita.');
      }
      setCreatedId(data.citaId); setDraft(null);
      setMessages(current => [...current, { role: 'assistant', text: 'Cita registrada correctamente. Ya está disponible en tu agenda.' }]);
    } catch (error) { setError(error instanceof Error ? error.message : 'Revisa tu conexión e intenta confirmar de nuevo.'); }
    finally { setBusy(false); }
  }

  function selectClient(next: ClientOption | null) {
    setClient(next); setClientQuery(''); setMatches([]);
    if (draft) void send('Prepara la cita', { client: next });
  }
  function newChat() {
    voice.cancel(); setMessages([welcome]); setDraft(null); setCreatedId(''); setInput(''); setError('');
  }
  const disabled = busy || isLoading || loadingCatalog || Boolean(unavailable);
  const expired = draft ? new Date(draft.expiresAt).getTime() <= now : false;

  return (
    <div className="flex min-h-dvh bg-background text-foreground lg:h-dvh lg:overflow-hidden">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pb-24 pt-16 lg:pb-0 lg:pt-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-7 lg:h-full lg:px-9 lg:py-8">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Tu agenda, en palabras</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Asistente NovaCita</h1><p className="mt-2 text-sm text-muted-foreground">Consulta horarios y prepara citas escribiendo o dictando.</p></div>
            <button onClick={newChat} disabled={disabled} className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-50"><Plus className="size-4" /> Nueva conversación</button>
          </header>
          {unavailable ? <div role="alert" className="rounded-2xl border border-border p-6"><h2 className="font-semibold">Asistente no disponible</h2><p className="mt-2 text-sm text-muted-foreground">{unavailable}</p><Link className="mt-4 inline-flex text-sm font-semibold text-primary" href="/citas">Continuar en Agenda <ChevronRight className="size-4" /></Link></div> : (
            <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section aria-label="Conversación con el asistente" className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:min-h-0">
                <div className="flex items-center gap-3 border-b border-border px-5 py-4"><span className="rounded-xl bg-primary/10 p-2 text-primary"><Sparkles className="size-5" /></span><div><h2 className="text-sm font-semibold">¿Qué necesitas organizar?</h2><p className="text-xs text-muted-foreground">Tú revisas y confirmas cada cita.</p></div></div>
                <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5" aria-live="polite" aria-relevant="additions">
                  {messages.map((message, index) => <div key={index} className={cn('max-w-full rounded-2xl px-4 py-3 text-sm', message.role === 'user' ? 'ml-8 border border-primary/15 bg-primary/10' : 'mr-3 bg-muted/50')}>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{message.role === 'user' ? 'Tú' : 'NovaCita'}</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                    {message.result?.mode === 'local' && message.result.fallbackReason && message.result.fallbackReason !== 'privacy' ? <p className="mt-2 text-xs text-muted-foreground">Asistencia local · puedes continuar sin Gemini.</p> : null}
                    {message.result?.agenda?.length ? <ul className="mt-3 space-y-2">{message.result.agenda.map(row => <li key={row.id} className="rounded-xl border border-border bg-background/60 p-3"><p className="font-semibold">{row.cliente}</p><p className="mt-1 text-xs">{row.fecha} · {formatTime12Hour(row.hora)} · {row.profesional}</p><p className="mt-1 text-xs text-muted-foreground">{row.servicios} · {row.estado.replaceAll('_', ' ')}</p></li>)}</ul> : null}
                    {message.result?.horarios?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.result.horarios.slice(0, 24).map(hora => <button key={hora} disabled={disabled} onClick={() => { const context = message.result?.horarioContexto; void send(`Prepara ${context?.servicios.join(" y ") || "la cita"} ${context?.fecha || ""} a las ${hora}`, context ? { employeeId: context.empleadoId } : undefined); }} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium hover:border-primary disabled:opacity-50">{formatTime12Hour(hora)}</button>)}{message.result.horarios.length > 24 ? <p className="w-full text-xs text-muted-foreground">Hay más horarios disponibles; también puedes escribir la hora.</p> : null}</div> : null}
                    {message.result?.resumen ? <dl className="mt-3 grid grid-cols-2 gap-2">{Object.entries(message.result.resumen).map(([estado, count]) => <div key={estado} className="rounded-lg border border-border bg-background p-2"><dt className="text-[10px] text-muted-foreground">{estado.replaceAll('_', ' ')}</dt><dd className="text-xl font-bold">{count}</dd></div>)}</dl> : null}
                  </div>)}
                  {busy ? <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" /> Revisando tu solicitud…</p> : null}
                  <div ref={bottom} />
                </div>
                <div className="border-t border-border p-4">
                  <div className="mb-3 flex flex-wrap gap-2">{['Mi agenda de hoy', 'Horarios disponibles mañana', 'Resumen de esta semana'].map(example => <button key={example} disabled={disabled || voice.listening} onClick={() => void send(example)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50">{example}</button>)}</div>
                  <form onSubmit={event => { event.preventDefault(); void send(); }} className="flex items-end gap-2">
                    <label className="sr-only" htmlFor="assistant-message">Tu mensaje</label>
                    <textarea id="assistant-message" value={input} onChange={event => setInput(event.target.value)} maxLength={1500} rows={2} disabled={disabled || voice.listening} placeholder="Ej.: Agenda corte mañana a las tres de la tarde" className="min-h-16 min-w-0 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                    <button type="button" aria-label={voice.listening ? 'Detener dictado' : 'Iniciar dictado'} aria-pressed={voice.listening} disabled={disabled || !voice.supported} onClick={() => { if (voice.listening) voice.stop(); else { voicePrefix.current = input.trim() ? `${input.trim()} ` : ''; voice.start(); } }} className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl border border-border disabled:opacity-40', voice.listening ? 'bg-destructive text-white' : 'bg-muted text-foreground')}>
                      {voice.listening ? <Square className="size-4" /> : <Mic className="size-5" />}
                    </button>
                    <button type="submit" aria-label="Enviar mensaje" disabled={disabled || voice.listening || !input.trim()} className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><Send className="size-4" /></button>
                  </form>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{voice.listening ? 'Escuchando… detén el dictado, revisa el texto y envíalo.' : voice.supported === false ? 'Este navegador no admite dictado. Puedes escribir tu consulta.' : 'El dictado puede procesarse en un servicio del navegador. Dicta solo servicios y horarios; selecciona al cliente en pantalla.'}</p>
                  {voice.listening ? <button type="button" onClick={() => { voice.cancel(); setInput(voicePrefix.current.trim()); }} className="mt-1 text-xs text-muted-foreground underline">Cancelar dictado</button> : null}
                  {voice.error ? <p role="alert" className="mt-2 text-xs text-destructive">{voice.error}</p> : null}
                  {error ? <div role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</div> : null}
                </div>
              </section>
              <aside className="contents lg:block lg:space-y-4 lg:overflow-y-auto lg:pb-2">
                <section className="order-first rounded-2xl border border-border bg-card p-5 lg:order-none"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><UserRound className="size-4 text-primary" /> Para esta cita</h2>
                  <label htmlFor="assistant-client" className="mb-2 block text-xs font-medium text-muted-foreground">Cliente</label>
                  {client ? <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{client.nombre}</p><p className="text-xs text-muted-foreground">{client.telefono || 'Cliente seleccionado'}</p></div><button aria-label="Cambiar cliente" disabled={disabled} onClick={() => selectClient(null)} className="p-1"><X className="size-4" /></button></div> : <><div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><input id="assistant-client" value={clientQuery} disabled={disabled} onChange={event => setClientQuery(event.target.value)} className={cn(fieldClass, 'pl-9')} placeholder="Buscar nombre o teléfono" autoComplete="off" /></div>
                    {searching ? <p className="mt-2 text-xs text-muted-foreground" role="status">Buscando…</p> : null}
                    {matches.length ? <ul aria-label="Clientes encontrados" className="mt-2 overflow-hidden rounded-xl border border-border">{matches.map(match => <li key={match.id}><button disabled={disabled} onClick={() => selectClient(match)} className="w-full px-3 py-3 text-left text-sm hover:bg-muted"><span className="block font-medium">{match.nombre}</span><span className="text-xs text-muted-foreground">{match.telefono || 'Sin teléfono'}</span></button></li>)}</ul> : null}
                    {clientQuery.trim().length >= 2 && !searching && !matches.length ? <p className="mt-2 text-xs text-muted-foreground">Busca un cliente existente. Si falta, <Link href="/clientes" className="text-primary underline">regístralo en Clientes</Link>.</p> : null}</>}
                  <label htmlFor="assistant-employee" className="mb-2 mt-4 block text-xs font-medium text-muted-foreground">Profesional</label>
                  <select id="assistant-employee" value={employeeId} disabled={disabled || user?.rol === 'EMPLEADO'} onChange={event => { const next = event.target.value; setEmployeeId(next); if (draft) void send('Prepara la cita', { employeeId: next }); }} className={fieldClass}><option value="">Seleccionar profesional</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.nombre}</option>)}</select>
                  <label htmlFor="assistant-service" className="mb-2 mt-4 block text-xs font-medium text-muted-foreground">Añadir un servicio al mensaje</label>
                  <select id="assistant-service" value="" disabled={disabled || voice.listening} onChange={event => { const service = services.find(item => item.id === event.target.value); if (service) setInput(current => current ? `${current} y ${service.nombre}` : `Agenda ${service.nombre}`); }} className={fieldClass}><option value="">Ver servicios</option>{services.map(service => <option key={service.id} value={service.id}>{service.nombre} · {service.duracion} min</option>)}</select>
                </section>
                {draft ? <section aria-label="Resumen de la cita" className="rounded-2xl border border-primary/25 bg-card p-5"><h2 className="flex items-center gap-2 font-semibold"><CalendarCheck2 className="size-5 text-primary" /> Revisa tu cita</h2><p className="mt-1 text-xs text-muted-foreground">Borrador · todavía no está registrada</p>
                  <dl className="mt-4 space-y-3 text-sm">{[['Cliente', draft.clienteNombre || 'Pendiente'], ['Profesional', draft.profesionalNombre || 'Pendiente'], ['Servicios', draft.servicios.map(service => service.nombre).join(' + ') || 'Pendiente'], ['Duración', `${draft.servicios.reduce((sum, service) => sum + service.duracion, 0)} minutos`], ['Fecha', draft.fecha ? formatDBDateLong(`${draft.fecha}T00:00:00Z`) : 'Pendiente'], ['Hora', draft.hora ? formatTime12Hour(draft.hora) : 'Pendiente']].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>)}</dl>
                  {draft.faltantes.length ? <ul className="mt-4 space-y-1 rounded-xl bg-muted p-3 text-xs text-muted-foreground">{draft.faltantes.map(item => <li key={item}>{item}</li>)}</ul> : null}
                  {expired ? <p role="status" className="mt-3 text-xs text-destructive">El borrador venció. Inicia una nueva conversación.</p> : <p className="mt-4 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3" /> Válido por 15 minutos desde el último cambio.</p>}
                  <button onClick={() => void confirm()} disabled={disabled || !draft.listo || expired} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-40"><Check className="size-4" /> Confirmar cita</button>
                </section> : null}
                {createdId ? <section role="status" className="rounded-2xl border border-primary/30 bg-primary/5 p-5"><CalendarCheck2 className="mb-3 size-7 text-primary" /><h2 className="font-semibold">Cita registrada</h2><p className="mt-1 text-sm text-muted-foreground">La cita ya aparece en la agenda.</p><Link href="/citas" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Ver agenda <ChevronRight className="size-4" /></Link></section> : null}
                <div className="rounded-2xl border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mb-2 size-4 text-primary" /><p>El cliente se identifica dentro de NovaCita. Gemini recibe solo instrucciones operativas filtradas.</p><p className="mt-2 font-medium">Esta versión comparte la base de datos del negocio: las citas que confirmes serán reales.</p></div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
