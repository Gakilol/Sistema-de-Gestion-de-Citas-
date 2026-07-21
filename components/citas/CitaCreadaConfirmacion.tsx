'use client';

import { useState, type ReactNode } from 'react';
import { CalendarDays, CalendarPlus, Check, CheckCircle2, Clipboard, Clock, Copy, Edit, Loader2, MessageCircle, Scissors, User, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { formatDBDateLong } from '@/lib/timezone';
import { formatTo12h } from '@/lib/utils';
import { calcularFinCita } from '@/lib/calendar-event';
import { toast } from 'sonner';

interface CitaCreadaConfirmacionProps {
  cita: any;
  open: boolean;
  onClose: () => void;
  onEdit: (cita: any) => void;
}

interface CalendarActions {
  url: string;
  googleCalendarUrl: string;
  waUrlConfirmacion: string | null;
  mensaje: string;
}

function getServicios(cita: any): string[] {
  if (Array.isArray(cita.citaServicios) && cita.citaServicios.length > 0) {
    return cita.citaServicios.map((item: any) => item.servicio?.nombre).filter(Boolean);
  }
  return cita.servicio?.nombre ? [cita.servicio.nombre] : [];
}

export function CitaCreadaConfirmacion({ cita, open, onClose, onEdit }: CitaCreadaConfirmacionProps) {
  const [loadingAction, setLoadingAction] = useState<'calendar' | 'whatsapp' | 'copy-info' | 'copy-link' | null>(null);
  if (!cita) return null;

  const fecha = typeof cita.fecha === 'string' ? cita.fecha.split('T')[0] : new Date(cita.fecha).toISOString().split('T')[0];
  const fin = calcularFinCita(fecha, cita.hora, cita.duracion);
  const servicios = getServicios(cita);
  const estado = cita.estado === 'CONFIRMADA' ? 'CONFIRMADA' : 'AGENDADA';

  const loadCalendarActions = async (): Promise<CalendarActions | null> => {
    const response = await fetch(`/api/citas/${cita.id}/calendario`);
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || 'No se pudo preparar el calendario');
      return null;
    }
    return data;
  };

  const withAction = async (action: NonNullable<typeof loadingAction>, callback: (data: CalendarActions) => Promise<void> | void) => {
    if (loadingAction) return;
    setLoadingAction(action);
    try {
      const data = await loadCalendarActions();
      if (data) await callback(data);
    } catch {
      toast.error('No se pudo completar la acción. Inténtalo nuevamente.');
    } finally {
      setLoadingAction(null);
    }
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  return (
    <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DrawerContent className="max-h-[90dvh] min-h-0 rounded-t-3xl border-border/50 bg-card sm:mx-auto sm:mb-8 sm:max-w-xl sm:rounded-2xl" aria-live="polite">
        <DrawerHeader className="shrink-0 border-b border-border/40 px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <DrawerTitle className="text-base">Cita creada correctamente</DrawerTitle>
              <DrawerDescription className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-700">
                  {estado}
                </span>
              </DrawerDescription>
            </div>
            <Button variant="ghost" size="icon" className="size-11 shrink-0" onClick={onClose} aria-label="Cerrar confirmaciÃ³n">
              <X />
            </Button>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="space-y-3">
            <Info icon={<User className="size-4 text-primary" />} label="Cliente" value={cita.cliente_nombre} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info icon={<CalendarDays className="size-4 text-blue-500" />} label="Fecha" value={formatDBDateLong(fecha)} />
              <Info icon={<Clock className="size-4 text-emerald-500" />} label="Horario" value={`${formatTo12h(cita.hora)} – ${formatTo12h(fin.hora)}`} detail={`${cita.duracion} minutos`} />
            </div>
            <Info icon={<Scissors className="size-4 text-purple-500" />} label="Profesional" value={cita.empleado?.nombre || 'Profesional'} />
            <div className="rounded-xl border border-border/30 bg-secondary/10 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Servicios</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {servicios.map((servicio) => <span key={servicio} className="rounded-lg border border-primary/15 bg-primary/8 px-2.5 py-1 text-xs font-medium">{servicio}</span>)}
              </div>
            </div>
          </div>
        </div>

        <DrawerFooter className="shrink-0 border-t border-border/40 bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <Button className="h-11 w-full" disabled={Boolean(loadingAction)} onClick={() => {
            const popup = window.open('', '_blank');
            if (!popup) {
              toast.error('El navegador bloqueó la apertura de Google Calendar');
              return;
            }
            popup.opener = null;
            withAction('calendar', (data) => { popup.location.href = data.googleCalendarUrl; });
          }}>
            {loadingAction === 'calendar' ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
            Agregar a Google Calendar
          </Button>
          {cita.cliente_telefono?.trim() && (
            <Button className="h-11 w-full bg-[#25D366] text-white hover:bg-[#1ebe5a]" disabled={Boolean(loadingAction)} onClick={() => {
              const popup = window.open('', '_blank');
              if (!popup) {
                toast.error('El navegador bloqueó la apertura de WhatsApp');
                return;
              }
              popup.opener = null;
              withAction('whatsapp', (data) => {
                if (!data.waUrlConfirmacion) {
                  popup.close();
                  toast.error('No se pudo preparar WhatsApp para este cliente');
                  return;
                }
                popup.location.href = data.waUrlConfirmacion;
              });
            }}>
              {loadingAction === 'whatsapp' ? <Loader2 className="animate-spin" /> : <MessageCircle />}
              Enviar al cliente
            </Button>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="outline" className="h-11" disabled={Boolean(loadingAction)} onClick={() => withAction('copy-info', (data) => copyText(data.mensaje, 'Información copiada'))}>
              {loadingAction === 'copy-info' ? <Loader2 className="animate-spin" /> : <Clipboard />}
              Copiar información
            </Button>
            <Button variant="outline" className="h-11" disabled={Boolean(loadingAction)} onClick={() => withAction('copy-link', (data) => copyText(data.url, 'Enlace de calendario copiado'))}>
              {loadingAction === 'copy-link' ? <Loader2 className="animate-spin" /> : <Copy />}
              Copiar enlace
            </Button>
            <Button variant="outline" className="h-11" disabled={Boolean(loadingAction)} onClick={() => { onClose(); onEdit(cita); }}>
              <Edit /> Editar cita
            </Button>
          </div>
          <Button variant="ghost" className="h-11" onClick={onClose}><Check /> Cerrar</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function Info({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail?: string }) {
  return <div className="flex items-start gap-3 rounded-xl border border-border/30 bg-secondary/20 p-3.5"><div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background">{icon}</div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-0.5 break-words text-sm font-semibold text-foreground">{value}</p>{detail && <p className="text-xs text-muted-foreground">{detail}</p>}</div></div>;
}
