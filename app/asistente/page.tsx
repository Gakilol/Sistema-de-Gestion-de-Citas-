'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  Loader2,
  Mic,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { useAuth } from '@/components/providers/auth-provider';
import { authFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDBDateLong } from '@/lib/timezone';
import { formatTime12Hour } from '@/lib/time-utils';
import { useDictation } from '@/lib/ia/use-dictation';
import { useSpeechSynthesis } from '@/lib/ia/use-speech-synthesis';
import type {
  AssistantReply,
  ClientOption,
  DraftOperation,
  DraftView,
  EmployeeOption,
  ServiceOption,
} from '@/lib/ia/domain';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  spokenText?: string;
  viaVoice?: boolean;
  result?: AssistantReply;
}

const ORDINAL_COMMANDS = ['la primera', 'la segunda', 'la tercera', 'la cuarta', 'la quinta', 'la sexta'];
const ORDINAL_MASC_COMMANDS = ['el primero', 'el segundo', 'el tercero', 'el cuarto', 'el quinto', 'el sexto'];

const welcome: Message = {
  role: 'assistant',
  text: 'Hola. Puedes hablarme o escribirme naturalmente para agendar, reprogramar, cancelar o consultar citas. Por ejemplo: «Agenda a Ana López para corte el viernes por la tarde».',
  spokenText:
    'Hola. Puedes hablarme o escribirme para gestionar citas y consultar horarios. Dime qué necesitas.',
};

const fieldClass =
  'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60';

function shortDateLabel(fechaYYYYMMDD: string): string {
  return formatDBDateLong(`${fechaYYYYMMDD}T00:00:00Z`)
    .replace(/,?\s+de\s+\d{4}$/, '')
    .replace(/,\s*/, ' ');
}

function confirmButtonLabel(operacion: DraftOperation): string {
  if (operacion === 'reprogramar') return 'Confirmar reprogramación';
  if (operacion === 'cancelar') return 'Confirmar cancelación';
  return 'Confirmar cita';
}

function summaryHeading(operacion: DraftOperation): string {
  if (operacion === 'reprogramar') return 'Revisa la reprogramación';
  if (operacion === 'cancelar') return 'Revisa la cancelación';
  return 'Revisa tu cita';
}

function confirmedHeading(operacion: DraftOperation): string {
  if (operacion === 'reprogramar') return 'Cita reprogramada';
  if (operacion === 'cancelar') return 'Cita cancelada';
  return 'Cita registrada';
}

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
  const [transcriptFromVoice, setTranscriptFromVoice] = useState(false);
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [highlightSummary, setHighlightSummary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [completedAction, setCompletedAction] = useState<{ id: string; operacion: DraftOperation } | null>(null);
  const [now, setNow] = useState(Date.now());

  const bottom = useRef<HTMLDivElement>(null);
  const summarySectionRef = useRef<HTMLElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voicePrefix = useRef('');
  const request = useRef<AbortController | null>(null);

  const tts = useSpeechSynthesis();

  const voice = useDictation(
    text => {
      setInput(`${voicePrefix.current}${text}`.slice(0, 1500));
      setTranscriptFromVoice(true);
      setVoiceSessionActive(true);
    },
    () => {
      tts.stop();
    },
  );

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    authFetch('/api/ia/contexto', { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo cargar el asistente.');
        setServices(data.servicios);
        setEmployees(data.empleados);
        if (user.rol === 'EMPLEADO') setEmployeeId(user.id);
      })
      .catch(err => {
        if (err.name !== 'AbortError') setUnavailable(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCatalog(false);
      });
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (client || clientQuery.trim().length < 2) {
      setMatches([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await authFetch(`/api/ia/clientes?q=${encodeURIComponent(clientQuery.trim())}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo buscar el cliente.');
        setMatches(data.clientes);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Error de búsqueda.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [clientQuery, client]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      clearInterval(timer);
      request.current?.abort();
    };
  }, []);

  function maybeSpeak(spokenText: string | undefined, shouldSpeak: boolean) {
    if (!shouldSpeak || !spokenText) return;
    if (tts.enabled && tts.canSpeak) {
      tts.speak(spokenText);
    }
  }

  async function send(
    text = input,
    options?: {
      client?: ClientOption | null;
      employeeId?: string;
      viaVoice?: boolean;
      overrideClient?: boolean;
    },
  ) {
    const trimmed = text.trim();
    if (!trimmed || busy || unavailable) return;

    const turnUsedVoice = Boolean(options?.viaVoice ?? transcriptFromVoice);
    const shouldSpeakReply = turnUsedVoice || voiceSessionActive;

    voice.cancel();
    tts.stop();
    setBusy(true);
    setError('');
    setInput('');
    setTranscriptFromVoice(false);
    setCompletedAction(null);
    setHighlightSummary(false);

    // Pending interpretation invalidates the visible confirmation until server responds.
    setDraft(current => (current ? { ...current, listo: false } : null));
    setMessages(current => [...current, { role: 'user', text: trimmed, viaVoice: turnUsedVoice }]);

    const controller = new AbortController();
    request.current = controller;

    const payloadBody: Record<string, unknown> = {
      mensaje: trimmed,
      ...(draft ? { borradorId: draft.id, revision: draft.revision } : {}),
    };
    if (options?.overrideClient) {
      payloadBody.clienteId = options.client?.id ?? null;
    } else if (client) {
      payloadBody.clienteId = client.id;
    }
    if (options?.employeeId !== undefined) {
      payloadBody.empleadoId = options.employeeId || null;
    } else if (employeeId) {
      payloadBody.empleadoId = employeeId;
    }

    try {
      const response = await authFetch('/api/ia/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo procesar la consulta.');
      const result = data as AssistantReply;
      const replySpoken = result.spokenText || result.text;

      setMessages(current => [
        ...current,
        { role: 'assistant', text: result.text, spokenText: replySpoken, result },
      ]);

      if (result.draftCleared) {
        setDraft(null);
        setHighlightSummary(false);
      } else if (result.draft) {
        setDraft(result.draft);
        if (result.draft.empleadoId && user?.rol !== 'EMPLEADO') {
          setEmployeeId(result.draft.empleadoId);
        }
        if (result.draft.clienteId && result.draft.clienteNombre) {
          setClient(current =>
            current?.id === result.draft?.clienteId
              ? current
              : { id: result.draft!.clienteId!, nombre: result.draft!.clienteNombre!, telefono: null },
          );
        }
      } else if (draft) {
        setDraft({ ...draft, listo: options?.overrideClient ? false : draft.listo });
      }

      if (result.highlightConfirmation) {
        setHighlightSummary(true);
        setTimeout(() => {
          summarySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          confirmButtonRef.current?.focus();
        }, 60);
      }

      maybeSpeak(replySpoken, shouldSpeakReply);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'No se pudo conectar.');
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function confirm() {
    if (!draft?.listo || busy) return;
    const currentOperation = draft.operacion ?? 'crear';
    tts.stop();
    setBusy(true);
    setError('');

    try {
      const response = await authFetch('/api/ia/citas/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borradorId: draft.id, revision: draft.revision }),
      });
      const data = await response.json();

      if (!response.ok) {
        const nextDraft = (data.draft as DraftView | undefined) ?? { ...draft, listo: false };
        setDraft(nextDraft);
        setHighlightSummary(false);

        if (data.code === 'SLOT_OCCUPIED' || data.horariosOfrecidos?.length) {
          const conflictText = data.error || 'Ese horario acaba de ocuparse. Elige una nueva opción.';
          const conflictSpoken = data.spokenText || conflictText;
          const conflictReply: AssistantReply = {
            text: conflictText,
            spokenText: conflictSpoken,
            mode: 'local',
            draft: nextDraft,
            horarios: data.horarios,
            horariosOfrecidos: data.horariosOfrecidos,
          };
          setMessages(current => [
            ...current,
            { role: 'assistant', text: conflictText, spokenText: conflictSpoken, result: conflictReply },
          ]);
          maybeSpeak(conflictSpoken, voiceSessionActive);
          return;
        }

        throw new Error(data.error || 'No se pudo completar la operación.');
      }

      const confirmedOp: DraftOperation = data.operacion ?? currentOperation;
      setCompletedAction({ id: data.citaId, operacion: confirmedOp });
      setDraft(null);
      setHighlightSummary(false);

      const okMessage =
        confirmedOp === 'reprogramar'
          ? 'Cita reprogramada correctamente. Ya se actualizó en tu agenda.'
          : confirmedOp === 'cancelar'
            ? 'Cita cancelada correctamente. El espacio quedó liberado en la agenda.'
            : 'Cita registrada correctamente. Ya está disponible en tu agenda.';

      setMessages(current => [
        ...current,
        { role: 'assistant', text: okMessage, spokenText: data.spokenText || okMessage },
      ]);
      maybeSpeak(data.spokenText || okMessage, voiceSessionActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revisa tu conexión e intenta confirmar de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function selectClientManual(next: ClientOption | null) {
    setClient(next);
    setClientQuery('');
    setMatches([]);
    if (draft) void send('Prepara la cita', { client: next, overrideClient: true });
  }

  function newChat() {
    voice.cancel();
    tts.stop();
    setMessages([welcome]);
    setDraft(null);
    setClient(null);
    if (user?.rol !== 'EMPLEADO') setEmployeeId('');
    setCompletedAction(null);
    setHighlightSummary(false);
    setInput('');
    setTranscriptFromVoice(false);
    setVoiceSessionActive(false);
    setError('');
  }

  const disabled = busy || isLoading || loadingCatalog || Boolean(unavailable);
  const expired = draft ? new Date(draft.expiresAt).getTime() <= now : false;
  const activeOp: DraftOperation = draft?.operacion ?? 'crear';

  return (
    <div className="flex min-h-dvh bg-background text-foreground lg:h-dvh lg:overflow-hidden">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pb-24 pt-16 lg:pb-0 lg:pt-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-7 lg:h-full lg:px-9 lg:py-8">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Tu agenda, por voz o mensaje
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Asistente NovaCita</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Di o escribe lo que necesitas; NovaCita consulta los datos reales y tú confirmas en pantalla.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {tts.canSpeak ? (
                <button
                  type="button"
                  onClick={() => {
                    if (tts.speaking) tts.stop();
                    else tts.setEnabled(!tts.enabled);
                  }}
                  aria-pressed={tts.enabled}
                  className={cn(
                    'flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors',
                    tts.enabled
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {tts.enabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4" />}
                  <span>{tts.speaking ? 'Detener voz' : tts.enabled ? 'Voz local activa' : 'Voz silenciada'}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={newChat}
                disabled={disabled}
                className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-50"
              >
                <Plus className="size-4" /> Nueva conversación
              </button>
            </div>
          </header>

          {unavailable ? (
            <div role="alert" className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-semibold">Asistente no disponible</h2>
              <p className="mt-2 text-sm text-muted-foreground">{unavailable}</p>
              <Link className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary" href="/citas">
                Continuar en Agenda <ChevronRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <section
                aria-label="Conversación con el asistente"
                className="flex min-h-[540px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:min-h-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-primary/10 p-2 text-primary">
                      <Sparkles className="size-5" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold">¿Qué necesitas organizar?</h2>
                      <p className="text-xs text-muted-foreground">
                        Puedes responder «la segunda», «mejor a las cuatro» o «¿y el sábado?».
                      </p>
                    </div>
                  </div>
                  {voice.privacyMode === 'local' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="size-3.5" /> Voz local en el dispositivo
                    </span>
                  ) : null}
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite" aria-relevant="additions">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        'max-w-full rounded-2xl px-4 py-3 text-sm',
                        message.role === 'user'
                          ? 'ml-6 border border-primary/20 bg-primary/10 sm:ml-12'
                          : 'mr-2 bg-muted/50 sm:mr-6',
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {message.role === 'user' ? (message.viaVoice ? 'Tú · voz' : 'Tú') : 'NovaCita'}
                        </p>
                        {message.role === 'assistant' && tts.canSpeak && (message.spokenText || message.text) ? (
                          <button
                            type="button"
                            onClick={() => tts.speak(message.spokenText || message.text, true)}
                            aria-label="Escuchar respuesta"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-background hover:text-foreground"
                          >
                            <Volume2 className="size-3.5" /> Escuchar
                          </button>
                        ) : null}
                      </div>

                      <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>

                      {message.result?.mode === 'local'
                      && message.result.fallbackReason
                      && message.result.fallbackReason !== 'privacy' ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Asistencia local · operando dentro de NovaCita.
                        </p>
                      ) : null}

                      {/* Homonymous / Ambiguous client candidates */}
                      {message.result?.clientesCandidatos?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Opciones de cliente">
                          {message.result.clientesCandidatos.map((candidate, idx) => (
                            <button
                              key={candidate.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                if (draft) {
                                  void send(ORDINAL_COMMANDS[idx] ?? `opción ${idx + 1}`);
                                } else {
                                  void send('Ver citas del cliente', {
                                    client: { id: candidate.id, nombre: candidate.nombre, telefono: null },
                                    overrideClient: true,
                                  });
                                }
                              }}
                              className="rounded-xl border border-border bg-background px-3 py-2 text-left text-xs font-medium hover:border-primary disabled:opacity-50"
                            >
                              <span className="font-bold text-primary">{idx + 1})</span> {candidate.nombre}
                              {candidate.pista ? (
                                <span className="ml-1.5 text-muted-foreground">· {candidate.pista}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {/* Ambiguous service candidates */}
                      {message.result?.serviciosCandidatos?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Opciones de servicio">
                          {message.result.serviciosCandidatos.map((service, idx) => (
                            <button
                              key={service.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => void send(ORDINAL_MASC_COMMANDS[idx] ?? service.nombre)}
                              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary disabled:opacity-50"
                            >
                              <span className="font-bold text-primary">{idx + 1})</span> {service.nombre} · {service.duracion} min
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {/* Ambiguous employee candidates */}
                      {message.result?.profesionalesCandidatos?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Opciones de profesional">
                          {message.result.profesionalesCandidatos.map((emp, idx) => (
                            <button
                              key={emp.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => void send(ORDINAL_MASC_COMMANDS[idx] ?? `con ${emp.nombre}`)}
                              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium hover:border-primary disabled:opacity-50"
                            >
                              <span className="font-bold text-primary">{idx + 1})</span> {emp.nombre}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {/* Multiple active appointments for reschedule/cancel */}
                      {message.result?.citasCandidatas?.length ? (
                        <div className="mt-3 space-y-2" role="group" aria-label="Citas activas para elegir">
                          {message.result.citasCandidatas.map((cita, idx) => (
                            <button
                              key={cita.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => void send(ORDINAL_COMMANDS[idx] ?? `opción ${idx + 1}`)}
                              className="block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-left text-xs hover:border-primary disabled:opacity-50"
                            >
                              <span className="font-bold text-primary">{idx + 1})</span>{' '}
                              <span className="font-semibold">
                                {shortDateLabel(cita.fecha)} · {formatTime12Hour(cita.hora)}
                              </span>
                              <span className="mt-0.5 block text-muted-foreground">
                                {cita.servicios.map(s => s.nombre).join(' + ')} · {cita.profesionalNombre}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {/* Real offered time slots */}
                      {message.result?.horariosOfrecidos?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Horarios sugeridos">
                          {message.result.horariosOfrecidos.map((slot, idx) => {
                            const multipleDates =
                              new Set(message.result?.horariosOfrecidos?.map(s => s.fecha)).size > 1;
                            return (
                              <button
                                key={`${slot.fecha}-${slot.hora}-${slot.empleadoId}`}
                                type="button"
                                disabled={disabled}
                                onClick={() => void send(ORDINAL_COMMANDS[idx] ?? `a las ${slot.hora}`)}
                                className="rounded-xl border border-border bg-background px-3 py-2 text-left text-xs font-medium hover:border-primary disabled:opacity-50"
                              >
                                <span className="font-bold text-primary">{idx + 1})</span>{' '}
                                {multipleDates ? `${shortDateLabel(slot.fecha)} · ` : ''}
                                <span className="tabular-nums font-semibold">{formatTime12Hour(slot.hora)}</span>
                                <span className="ml-1.5 text-muted-foreground">· {slot.empleadoNombre}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : message.result?.horarios?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.result.horarios.slice(0, 20).map(hora => (
                            <button
                              key={hora}
                              type="button"
                              disabled={disabled}
                              onClick={() => void send(`A las ${hora}`)}
                              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:border-primary disabled:opacity-50"
                            >
                              {formatTime12Hour(hora)}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {/* Agenda list */}
                      {message.result?.agenda?.length ? (
                        <ul className="mt-3 space-y-2">
                          {message.result.agenda.map(row => (
                            <li key={row.id} className="rounded-xl border border-border bg-background/70 p-3">
                              <p className="font-semibold">{row.cliente}</p>
                              <p className="mt-1 text-xs tabular-nums">
                                {shortDateLabel(row.fecha)} · {formatTime12Hour(row.hora)} · {row.profesional}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {row.servicios} · {row.estado.replaceAll('_', ' ')}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {/* Summary metrics */}
                      {message.result?.resumen ? (
                        <dl className="mt-3 grid grid-cols-2 gap-2">
                          {Object.entries(message.result.resumen).map(([estado, count]) => (
                            <div key={estado} className="rounded-lg border border-border bg-background p-2">
                              <dt className="text-[10px] text-muted-foreground">{estado.replaceAll('_', ' ')}</dt>
                              <dd className="text-xl font-bold tabular-nums">{count}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                  ))}

                  {busy ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                      <Loader2 className="size-4 animate-spin" /> Consultando NovaCita…
                    </p>
                  ) : null}
                  <div ref={bottom} />
                </div>

                {/* Composer */}
                <div className="border-t border-border p-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {[
                      'Mi agenda de hoy',
                      'Horarios disponibles mañana por la tarde',
                      'Resumen de esta semana',
                    ].map(example => (
                      <button
                        key={example}
                        type="button"
                        disabled={disabled || voice.listening}
                        onClick={() => void send(example)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-50"
                      >
                        {example}
                      </button>
                    ))}
                  </div>

                  {/* External browser speech recognition consent notice */}
                  {voice.needsExternalConsent ? (
                    <div
                      role="region"
                      aria-label="Aviso de privacidad del reconocimiento de voz"
                      className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">
                            Este navegador no confirma reconocimiento de voz sin conexión
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            El dictado del navegador puede enviar audio al servicio de voz del navegador (nunca a Gemini).
                            Para mantener nombres de clientes 100% dentro de NovaCita, puedes escribir tu mensaje o activar el dictado bajo tu consentimiento.
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {voice.privacyMode === 'downloadable' ? (
                              <button
                                type="button"
                                disabled={voice.installingPack}
                                onClick={() => void voice.installLocalPack()}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                              >
                                <Download className="size-3.5" />
                                {voice.installingPack ? 'Instalando voz local…' : 'Instalar paquete de voz local'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => voice.enableExternalAndStart()}
                              className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:border-primary"
                            >
                              Activar dictado del navegador
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                voice.dismissConsent();
                                inputRef.current?.focus();
                              }}
                              className="inline-flex h-9 items-center rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              Seguir por texto
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Editable transcript status pill */}
                  {voice.listening || transcriptFromVoice ? (
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs">
                      <span className="font-medium text-foreground">
                        {voice.listening
                          ? 'Escuchando… detén el micrófono para revisar o corregir la transcripción.'
                          : 'Transcripción lista: puedes corregir cualquier palabra antes de enviar.'}
                      </span>
                      {voice.listening ? (
                        <button
                          type="button"
                          onClick={() => {
                            voice.cancel();
                            setInput(voicePrefix.current.trim());
                            setTranscriptFromVoice(false);
                          }}
                          className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
                        >
                          Cancelar dictado
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <form
                    onSubmit={event => {
                      event.preventDefault();
                      void send();
                    }}
                    className="flex items-end gap-2"
                  >
                    <label className="sr-only" htmlFor="assistant-message">
                      Tu mensaje
                    </label>
                    <textarea
                      ref={inputRef}
                      id="assistant-message"
                      value={input}
                      onChange={event => setInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey && !voice.listening) {
                          event.preventDefault();
                          void send();
                        }
                      }}
                      maxLength={1500}
                      rows={2}
                      disabled={disabled || voice.listening}
                      placeholder="Ej.: Agenda a Ana López para corte el viernes por la tarde"
                      className="min-h-16 min-w-0 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      type="button"
                      aria-label={voice.listening ? 'Detener dictado' : 'Iniciar dictado'}
                      aria-pressed={voice.listening}
                      disabled={disabled || voice.supported !== true}
                      onClick={() => {
                        if (voice.listening) {
                          voice.stop();
                        } else {
                          voicePrefix.current = input.trim() ? `${input.trim()} ` : '';
                          voice.start();
                        }
                      }}
                      className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-xl border border-border transition-colors disabled:opacity-40',
                        voice.listening ? 'bg-destructive text-white' : 'bg-muted text-foreground hover:border-primary',
                      )}
                    >
                      {voice.listening ? <Square className="size-4" /> : <Mic className="size-5" />}
                    </button>
                    <button
                      type="submit"
                      aria-label="Enviar mensaje"
                      disabled={disabled || voice.listening || !input.trim()}
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
                    >
                      <Send className="size-4" />
                    </button>
                  </form>

                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {voice.supported === false
                      ? 'Este navegador no admite reconocimiento de voz. Puedes usar toda la conversación escribiendo.'
                      : voice.privacyMode === 'local'
                        ? 'Reconocimiento de voz local activo. Revisa o corrige la transcripción antes de enviar.'
                        : voice.allowExternalDictation
                          ? 'Dictado del navegador activo (el audio se procesa en el navegador, nunca en Gemini). Revisa el texto antes de enviar.'
                          : 'Pulsa el micrófono para dictar o escribe directamente. Las respuestas habladas solo usan voces locales del dispositivo.'}
                    {tts.blockedRemoteOnly
                      ? ' · Sin voz local en español disponible en este navegador; respuestas mostradas solo en texto.'
                      : ''}
                  </p>

                  {voice.error ? (
                    <p role="alert" className="mt-2 text-xs text-destructive">
                      {voice.error}
                    </p>
                  ) : null}
                  {error ? (
                    <div role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                      {error}
                    </div>
                  ) : null}
                </div>
              </section>

              {/* Right Column: Pending Confirmation Summary + Optional Manual Override */}
              <aside className="space-y-4 lg:overflow-y-auto lg:pb-2">
                {draft ? (
                  <section
                    ref={summarySectionRef}
                    aria-label="Resumen de la cita"
                    className={cn(
                      'rounded-2xl border bg-card p-5 transition-shadow',
                      highlightSummary
                        ? 'border-primary ring-2 ring-primary/60 shadow-lg'
                        : 'border-primary/25',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="flex items-center gap-2 font-semibold">
                          {activeOp === 'reprogramar' ? (
                            <CalendarClock className="size-5 text-primary" />
                          ) : (
                            <CalendarCheck2 className="size-5 text-primary" />
                          )}
                          {summaryHeading(activeOp)}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {activeOp === 'cancelar'
                            ? 'Pendiente · todavía no se ha cancelado'
                            : activeOp === 'reprogramar'
                              ? 'Pendiente · el cambio se aplica al confirmar'
                              : 'Borrador · todavía no está registrada'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void send('Descarta el borrador')}
                        disabled={disabled}
                        aria-label="Descartar borrador"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    {highlightSummary && draft.listo ? (
                      <div
                        role="status"
                        className="mt-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-foreground"
                      >
                        Confirmación en pantalla requerida: pulsa el botón de abajo para completar la operación.
                      </div>
                    ) : null}

                    {draft.citaObjetivoResumen && activeOp !== 'crear' ? (
                      <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-xs">
                        <p className="font-semibold text-muted-foreground">Cita actual</p>
                        <p className="mt-1 font-medium text-foreground">
                          {draft.citaObjetivoResumen.clienteNombre} · {draft.citaObjetivoResumen.servicios}
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          {shortDateLabel(draft.citaObjetivoResumen.fecha)} ·{' '}
                          {formatTime12Hour(draft.citaObjetivoResumen.hora)} ·{' '}
                          {draft.citaObjetivoResumen.profesionalNombre}
                        </p>
                      </div>
                    ) : null}

                    <dl className="mt-4 space-y-2.5 text-sm">
                      {(activeOp === 'cancelar'
                        ? [
                            ['Cliente', draft.clienteNombre || 'Pendiente'],
                            ['Profesional', draft.profesionalNombre || 'Pendiente'],
                            ['Servicios', draft.citaObjetivoResumen?.servicios || draft.servicios.map(s => s.nombre).join(' + ') || 'Pendiente'],
                            ['Fecha', draft.citaObjetivoResumen?.fecha ? formatDBDateLong(`${draft.citaObjetivoResumen.fecha}T00:00:00Z`) : 'Pendiente'],
                            ['Hora', draft.citaObjetivoResumen?.hora ? formatTime12Hour(draft.citaObjetivoResumen.hora) : 'Pendiente'],
                          ]
                        : [
                            ['Cliente', draft.clienteNombre || 'Pendiente'],
                            ['Servicios', draft.servicios.map(service => service.nombre).join(' + ') || 'Pendiente'],
                            ['Duración', draft.servicios.length ? `${draft.servicios.reduce((sum, service) => sum + service.duracion, 0)} minutos` : 'Pendiente'],
                            [activeOp === 'reprogramar' ? 'Nueva fecha' : 'Fecha', draft.fecha ? formatDBDateLong(`${draft.fecha}T00:00:00Z`) : 'Pendiente'],
                            [activeOp === 'reprogramar' ? 'Nueva hora' : 'Hora', draft.hora ? formatTime12Hour(draft.hora) : 'Pendiente'],
                            ['Personal asignado', draft.profesionalNombre || 'Se asignará según disponibilidad'],
                          ]
                      ).map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-muted-foreground">{label}</dt>
                          <dd className="mt-0.5 font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>

                    {draft.faltantes.length ? (
                      <ul className="mt-4 space-y-1 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                        {draft.faltantes.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}

                    {expired ? (
                      <p role="status" className="mt-3 text-xs text-destructive">
                        El borrador venció. Inicia una nueva solicitud.
                      </p>
                    ) : (
                      <p className="mt-4 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock3 className="size-3" /> Válido por 15 minutos desde el último cambio.
                      </p>
                    )}

                    <button
                      ref={confirmButtonRef}
                      type="button"
                      onClick={() => void confirm()}
                      disabled={disabled || !draft.listo || expired}
                      className={cn(
                        'mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-40',
                        activeOp === 'cancelar'
                          ? 'bg-destructive text-white'
                          : 'bg-primary text-primary-foreground',
                      )}
                    >
                      <Check className="size-4" /> {confirmButtonLabel(activeOp)}
                    </button>
                  </section>
                ) : (
                  <section className="rounded-2xl border border-border bg-card p-5">
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                      <CalendarCheck2 className="size-4 text-primary" /> Resumen pendiente
                    </h2>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      Cuando pidas agendar, reprogramar o cancelar una cita, aquí aparecerá el resumen completo con el botón de confirmación en pantalla.
                    </p>
                  </section>
                )}

                {completedAction ? (
                  <section role="status" className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
                    <CalendarCheck2 className="mb-3 size-7 text-primary" />
                    <h2 className="font-semibold">{confirmedHeading(completedAction.operacion)}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      El cambio ya está reflejado en la agenda de NovaCita.
                    </p>
                    <Link href="/citas" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      Ver agenda <ChevronRight className="size-4" />
                    </Link>
                  </section>
                ) : null}

                {/* Optional progressive-disclosure manual context controls */}
                <details className="group rounded-2xl border border-border bg-card p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                    <span className="flex items-center gap-2">
                      <UserRound className="size-4 text-primary" /> Selección manual opcional
                    </span>
                    <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label htmlFor="assistant-client" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Cliente
                      </label>
                      {client ? (
                        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{client.nombre}</p>
                            <p className="text-xs text-muted-foreground">{client.telefono || 'Cliente seleccionado'}</p>
                          </div>
                          <button
                            type="button"
                            aria-label="Cambiar cliente"
                            disabled={disabled}
                            onClick={() => selectClientManual(null)}
                            className="p-1"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
                            <input
                              id="assistant-client"
                              value={clientQuery}
                              disabled={disabled}
                              onChange={event => setClientQuery(event.target.value)}
                              className={cn(fieldClass, 'pl-9')}
                              placeholder="Buscar nombre o teléfono"
                              autoComplete="off"
                            />
                          </div>
                          {searching ? (
                            <p className="mt-1.5 text-xs text-muted-foreground" role="status">
                              Buscando…
                            </p>
                          ) : null}
                          {matches.length ? (
                            <ul aria-label="Clientes encontrados" className="mt-2 overflow-hidden rounded-xl border border-border">
                              {matches.map(match => (
                                <li key={match.id}>
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => selectClientManual(match)}
                                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted"
                                  >
                                    <span className="block font-medium">{match.nombre}</span>
                                    <span className="text-xs text-muted-foreground">{match.telefono || 'Sin teléfono'}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </>
                      )}
                    </div>

                    <div>
                      <label htmlFor="assistant-employee" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Profesional
                      </label>
                      <select
                        id="assistant-employee"
                        value={employeeId}
                        disabled={disabled || user?.rol === 'EMPLEADO'}
                        onChange={event => {
                          const next = event.target.value;
                          setEmployeeId(next);
                          if (draft) void send(next ? 'Prepara la cita' : 'Cualquier profesional', { employeeId: next });
                        }}
                        className={fieldClass}
                      >
                        <option value="">Cualquier profesional disponible</option>
                        {employees.map(employee => (
                          <option key={employee.id} value={employee.id}>
                            {employee.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="assistant-service" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Añadir servicio al mensaje
                      </label>
                      <select
                        id="assistant-service"
                        value=""
                        disabled={disabled || voice.listening}
                        onChange={event => {
                          const service = services.find(item => item.id === event.target.value);
                          if (service) {
                            setInput(current => (current ? `${current} y ${service.nombre}` : `Agenda ${service.nombre}`));
                          }
                        }}
                        className={fieldClass}
                      >
                        <option value="">Ver servicios</option>
                        {services.map(service => (
                          <option key={service.id} value={service.id}>
                            {service.nombre} · {service.duracion} min
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </details>

                <div className="rounded-2xl border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mb-2 size-4 text-primary" />
                  <p>
                    Las identidades de clientes, las consultas internas y las respuestas se procesan dentro de NovaCita. Gemini recibe únicamente comandos operativos filtrados y referencias temporales de catálogo.
                  </p>
                  <p className="mt-2 font-medium">
                    Esta versión comparte la base de datos del negocio: las citas que confirmes en pantalla serán reales.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
