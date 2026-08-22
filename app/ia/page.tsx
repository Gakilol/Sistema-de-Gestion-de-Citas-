'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, CalendarPlus, Check, CheckCircle2, Loader2, Mic, MicOff, Search, Send, Sparkles, UserPlus, UserRound, X } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/brand';
import { authFetch } from '@/lib/api-client';
import type { IAAppointmentDraft, IAClientDraft, IAPendingAction } from '@/lib/ia/types';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  pendingAction?: IAPendingAction;
  actionStatus?: 'confirming' | 'completed' | 'cancelled' | 'error';
  actionError?: string;
  appointmentDraft?: IAAppointmentDraft;
  clientDraft?: IAClientDraft;
}

interface SpeechResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechEventLike {
  results: ArrayLike<SpeechResultLike>;
}

interface SpeechController {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechConstructor = new () => SpeechController;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechConstructor;
  webkitSpeechRecognition?: SpeechConstructor;
};

const welcome: Message = {
  role: 'assistant',
  content: `Hola, soy ${BRAND.assistantName}. Puedo ayudarte a crear una cita, registrar un cliente o consultar la agenda. Te preguntaré solo lo necesario y siempre te mostraré un resumen antes de guardar.`,
};

const quickTasks = [
  { title: 'Crear una cita', example: 'Quiero crear una cita', description: 'Busco servicio, profesional y horario.', icon: CalendarPlus },
  { title: 'Registrar cliente', example: 'Quiero registrar un cliente', description: 'Te pediré nombre y datos opcionales.', icon: UserPlus },
  { title: 'Consultar agenda', example: '¿Quién viene hoy?', description: 'Reviso los datos reales del sistema.', icon: Search },
];

function MessageText({ content }: { content: string }) {
  return (
    <div className="space-y-1.5 text-[15px] leading-6 sm:text-base">
      {content.split('\n').map((line, index) => (
        line.startsWith('- ')
          ? <div key={index} className="flex gap-2"><span className="font-bold text-primary">•</span><span>{line.slice(2)}</span></div>
          : line.trim() ? <p key={index}>{line}</p> : <div key={index} className="h-1" />
      ))}
    </div>
  );
}

function PendingActionCard({ message, onConfirm, onCancel }: { message: Message; onConfirm: () => void; onCancel: () => void }) {
  const action = message.pendingAction;
  if (!action) return null;
  const busy = message.actionStatus === 'confirming';
  const done = message.actionStatus === 'completed';
  const cancelled = message.actionStatus === 'cancelled';

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border-2 border-primary/45 bg-background shadow-sm" aria-label="Confirmación requerida">
      <div className="flex items-start gap-3 border-b border-primary/20 bg-primary/10 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          {done ? <CheckCircle2 className="size-5" /> : <Check className="size-5" />}
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{done ? 'Operación realizada' : 'Revisa antes de guardar'}</p>
          <h2 className="mt-0.5 text-lg font-bold text-foreground">{action.title}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{action.description}</p>
        </div>
      </div>

      <dl className="divide-y divide-border/70 px-4">
        {action.details.map((detail) => (
          <div key={`${detail.label}-${detail.value}`} className="grid gap-1 py-3 text-sm min-[430px]:grid-cols-[7rem_1fr] min-[430px]:gap-3 sm:grid-cols-[9rem_1fr] sm:text-base">
            <dt className="font-semibold text-muted-foreground">{detail.label}</dt>
            <dd className="font-semibold text-foreground">{detail.value}</dd>
          </div>
        ))}
      </dl>

      {message.actionError && <p role="alert" className="mx-4 mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">{message.actionError}</p>}

      <div className="flex flex-col gap-2 p-4 sm:flex-row">
        {done ? (
          <div className="flex min-h-12 w-full items-center gap-2 rounded-xl bg-emerald-600/10 px-4 font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-5" /> Listo, quedó guardado en el sistema.</div>
        ) : cancelled ? (
          <div className="flex min-h-12 w-full items-center gap-2 rounded-xl bg-secondary px-4 font-semibold text-muted-foreground"><X className="size-5" /> Operación cancelada. No se guardó nada.</div>
        ) : (
          <>
            <Button type="button" size="lg" className="min-h-12 flex-1 text-base" onClick={onConfirm} disabled={busy}>
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}{busy ? 'Guardando…' : action.confirmLabel}
            </Button>
            <Button type="button" size="lg" variant="outline" className="min-h-12 text-base" onClick={onCancel} disabled={busy}>No, cancelar</Button>
          </>
        )}
      </div>
    </section>
  );
}

export default function IAPage() {
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechController | null>(null);

  useEffect(() => {
    const suggestedPrompt = new URLSearchParams(window.location.search).get('prompt');
    if (suggestedPrompt) {
      setInput(suggestedPrompt.slice(0, 2500));
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSpeechSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => recognitionRef.current?.stop();
  }, []);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    const initialInput = input.trim();
    recognition.lang = 'es-NI';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? '';
      }
      setInput([initialInput, transcript.trim()].filter(Boolean).join(' '));
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error !== 'aborted') {
        setSpeechError(event.error === 'not-allowed'
          ? 'Permite el acceso al micrófono en el navegador para poder dictar.'
          : 'No pude escuchar con claridad. Intenta hablar de nuevo.');
      }
    };
    recognition.onend = () => {
      setListening(false);
      inputRef.current?.focus();
    };
    recognitionRef.current = recognition;
    setSpeechError('');
    setListening(true);
    recognition.start();
  };

  const send = async (text: string, resetConversation = false) => {
    const content = text.trim();
    if (!content || loading) return;
    recognitionRef.current?.stop();
    const nextMessages = [...(resetConversation ? [welcome] : messages), { role: 'user' as const, content }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const response = await authFetch('/api/ia/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content: messageContent, appointmentDraft, clientDraft }) => ({ role, content: messageContent, appointmentDraft, clientDraft })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pude completar la consulta.');
      setMessages((current) => [...current, { role: 'assistant', content: data.text, toolsUsed: data.toolsUsed, pendingAction: data.pendingAction, appointmentDraft: data.appointmentDraft, clientDraft: data.clientDraft }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error instanceof Error ? error.message : 'No pude completar la consulta.' }]);
    } finally {
      setLoading(false);
    }
  };

  const updateActionMessage = (index: number, patch: Partial<Message>) => {
    setMessages((current) => current.map((message, messageIndex) => messageIndex === index ? { ...message, ...patch } : message));
  };

  const confirmAction = async (index: number) => {
    const action = messages[index]?.pendingAction;
    if (!action || messages[index].actionStatus === 'confirming') return;
    updateActionMessage(index, { actionStatus: 'confirming', actionError: undefined });
    try {
      const response = await authFetch(action.endpoint, {
        method: action.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action.body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar. Revisa los datos e intenta de nuevo.');
      updateActionMessage(index, { actionStatus: 'completed', actionError: undefined });
      setMessages((current) => [...current, {
        role: 'assistant',
        content: action.type === 'CREATE_APPOINTMENT'
          ? 'La cita quedó creada y ya aparece en la Agenda.'
          : action.type === 'CREATE_CLIENT'
            ? 'El cliente quedó registrado y ya aparece en Clientes.'
            : 'El estado de la cita quedó actualizado.',
      }]);
    } catch (error) {
      updateActionMessage(index, { actionStatus: 'error', actionError: error instanceof Error ? error.message : 'No se pudo guardar.' });
    }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); void send(input); };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pb-20 pt-20 lg:pb-0 lg:pt-0">
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl flex-col px-3 py-5 sm:px-6 sm:py-7 lg:min-h-dvh lg:px-8">
          <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-primary">Asistente del salón</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">¿Qué necesitas hacer?</h1>
              <p className="mt-2 max-w-2xl text-base leading-6 text-muted-foreground">Habla o escribe con naturalidad. Te preguntaré un dato a la vez.</p>
            </div>
            <div className="flex flex-col gap-2 min-[430px]:flex-row sm:shrink-0">
              <Button type="button" size="lg" className="min-h-12 text-base" onClick={() => void send('Quiero crear una cita guiada', true)} disabled={loading}>
                <CalendarPlus className="size-5" /> Crear cita con IA
              </Button>
              <Button asChild type="button" size="lg" variant="outline" className="min-h-12 text-base">
                <Link href="/citas?nueva=1">Abrir formulario</Link>
              </Button>
            </div>
          </header>

          {messages.length === 1 && (
            <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Acciones rápidas">
              {quickTasks.map(({ title, example, description, icon: Icon }) => (
                <button key={title} type="button" onClick={() => void send(example, title === 'Crear una cita')} disabled={loading} className="group flex min-h-32 flex-col items-start rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/55 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-50">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary"><Icon className="size-5" /></span>
                  <span className="mt-3 flex w-full items-center justify-between gap-2 text-base font-bold text-foreground">{title}<ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-1" /></span>
                  <span className="mt-1 text-sm leading-5 text-muted-foreground">{description}</span>
                </button>
              ))}
            </section>
          )}

          <section className="mb-20 flex min-h-[34rem] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:mb-0">
            <div aria-live="polite" className="flex-1 space-y-5 overflow-y-auto p-3 sm:p-5">
              {messages.map((message, index) => {
                const assistant = message.role === 'assistant';
                return (
                  <article key={index} className={cn('flex items-start gap-2.5', !assistant && 'flex-row-reverse')}>
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl border', assistant ? 'border-primary/35 bg-primary/10 text-primary' : 'border-border bg-secondary text-foreground', assistant && message.pendingAction && 'hidden sm:flex')}>
                      {assistant ? <Bot className="size-5" /> : <UserRound className="size-5" />}
                    </span>
                    <div className={cn('rounded-2xl border px-4 py-3.5', assistant && message.pendingAction ? 'min-w-0 flex-1 border-border bg-background text-foreground' : assistant ? 'max-w-[min(46rem,88%)] border-border bg-background text-foreground' : 'max-w-[min(46rem,88%)] border-primary/45 bg-primary text-primary-foreground')}>
                      <MessageText content={message.content} />
                      {message.pendingAction && <PendingActionCard message={message} onConfirm={() => void confirmAction(index)} onCancel={() => updateActionMessage(index, { actionStatus: 'cancelled', actionError: undefined })} />}
                      {message.toolsUsed && message.toolsUsed.length > 0 && <p className="mt-3 border-t border-current/10 pt-2 text-[11px] font-bold uppercase tracking-wider opacity-60">Datos verificados en HAIR STYLE</p>}
                    </div>
                  </article>
                );
              })}
              {loading && <div className="flex min-h-12 items-center gap-3 rounded-xl bg-secondary/60 px-4 text-sm font-medium text-muted-foreground"><Loader2 className="size-5 animate-spin text-primary" /> Revisando el sistema…</div>}
              <div ref={endRef} />
            </div>

            <form onSubmit={submit} className="border-t border-border bg-background p-3 sm:p-4">
              <div className="flex items-end gap-2">
                <label className="sr-only" htmlFor="ia-message">Mensaje para el asistente</label>
                <textarea ref={inputRef} id="ia-message" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(input); } }} maxLength={2500} rows={1} placeholder="Ejemplo: crea una cita para Ana mañana…" className="min-h-12 max-h-32 flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" />
                {speechSupported && (
                  <Button type="button" size="icon" variant={listening ? 'default' : 'outline'} className="size-12 shrink-0 rounded-xl" onClick={toggleVoice} aria-label={listening ? 'Detener dictado' : 'Dictar mensaje con el micrófono'} aria-pressed={listening}>
                    {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                  </Button>
                )}
                <Button type="submit" size="icon" className="size-12 shrink-0 rounded-xl" disabled={loading || !input.trim()} aria-label="Enviar mensaje"><Send className="size-5" /></Button>
              </div>
              {speechError && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{speechError}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3.5 text-primary" /> Ningún cambio se guarda sin tu confirmación.</p>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
