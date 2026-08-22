'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, CalendarDays, Loader2, Search, Send, Sparkles, UserRound, UsersRound } from 'lucide-react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/brand';
import { authFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface Message { role: 'user' | 'assistant'; content: string; toolsUsed?: string[]; }

const welcome: Message = {
  role: 'assistant',
  content: `Hola, soy ${BRAND.assistantName}. Puedo revisar la agenda, resumir estados, buscar clientes y analizar servicios o carga del equipo sin modificar ningún registro.`,
};

const suggestions = [
  { text: '¿Quién viene hoy?', icon: CalendarDays },
  { text: 'Dame un resumen de las citas de hoy', icon: Sparkles },
  { text: '¿Cuáles son los servicios más solicitados en 30 días?', icon: Search },
  { text: '¿Cómo está distribuida la carga del equipo?', icon: UsersRound },
];

function MessageText({ content }: { content: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-6">
      {content.split('\n').map((line, index) => (
        line.startsWith('- ')
          ? <div key={index} className="flex gap-2"><span className="text-primary">•</span><span>{line.slice(2)}</span></div>
          : line.trim() ? <p key={index}>{line}</p> : <div key={index} className="h-1" />
      ))}
    </div>
  );
}

export default function IAPage() {
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const response = await authFetch('/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pude completar la consulta.');
      setMessages((current) => [...current, { role: 'assistant', content: data.text, toolsUsed: data.toolsUsed }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error instanceof Error ? error.message : 'No pude completar la consulta.' }]);
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); void send(input); };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pt-16 lg:pt-0">
        <div className="app-page page-enter flex min-h-[calc(100dvh-4rem)] flex-col gap-4 lg:min-h-dvh">
          <PageHeader eyebrow="Asistencia operativa" title={BRAND.assistantName} description="Consulta datos reales con permisos por rol. El asistente no modifica registros." />

          <section className="surface-panel flex min-h-[36rem] flex-1 flex-col overflow-hidden">
            <div className="border-b border-border/70 bg-secondary/45 px-3 py-3 sm:px-5">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {suggestions.map(({ text, icon: Icon }) => (
                  <button key={text} type="button" onClick={() => void send(text)} disabled={loading} className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/8 disabled:opacity-50">
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="line-clamp-2">{text}</span>
                  </button>
                ))}
              </div>
            </div>

            <div aria-live="polite" className="flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-5">
              {messages.map((message, index) => {
                const assistant = message.role === 'assistant';
                return (
                  <article key={index} className={cn('flex items-start gap-2.5', !assistant && 'flex-row-reverse')}>
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg border', assistant ? 'border-primary/35 bg-primary/10 text-primary' : 'border-border bg-secondary text-foreground')}>
                      {assistant ? <Bot className="size-4" /> : <UserRound className="size-4" />}
                    </span>
                    <div className={cn('max-w-[min(46rem,86%)] rounded-xl border px-3.5 py-3 sm:px-4', assistant ? 'border-border bg-card text-card-foreground' : 'border-primary/45 bg-primary text-primary-foreground')}>
                      <MessageText content={message.content} />
                      {message.toolsUsed && message.toolsUsed.length > 0 && <p className="mt-2 border-t border-current/10 pt-2 text-[10px] font-semibold uppercase tracking-wider opacity-65">Datos verificados en el sistema</p>}
                    </div>
                  </article>
                );
              })}
              {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" /> Consultando datos autorizados…</div>}
              <div ref={endRef} />
            </div>

            <form onSubmit={submit} className="border-t border-border bg-card p-3 sm:p-4">
              <div className="flex items-end gap-2">
                <label className="sr-only" htmlFor="ia-message">Mensaje para el asistente</label>
                <textarea id="ia-message" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(input); } }} maxLength={2500} rows={1} placeholder="Pregunta por la agenda, clientes o servicios…" className="min-h-11 max-h-32 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 sm:text-sm" />
                <Button type="submit" size="icon" className="size-11 shrink-0" disabled={loading || !input.trim()} aria-label="Enviar mensaje"><Send className="size-4" /></Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">La IA puede equivocarse al explicar; los datos operativos provienen de consultas controladas.</p>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
