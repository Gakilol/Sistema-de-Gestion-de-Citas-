// components/citas/CitaDetalleBottomSheet.tsx
// Panel inferior compacto (Bottom Sheet) para ver el detalle de una cita existente y realizar acciones rápidas según el rol.

'use client';

import { useState, useEffect } from 'react';
import {
  X,
  User,
  Clock,
  CalendarDays,
  Scissors,
  Edit,
  MessageCircle,
  Copy,
  Check,
  Loader2,
  WifiOff,
  Share2,
} from 'lucide-react';
import {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildSharePayload } from '@/lib/calendar-share';
import { toast } from 'sonner';

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  EN_PROGRESO: 'En Progreso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  NO_SHOW: 'No se presentó',
  REPROGRAMADA: 'Reprogramada',
};

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'badge-pendiente',
  CONFIRMADA: 'badge-confirmada',
  EN_PROGRESO: 'badge-en_progreso',
  COMPLETADA: 'badge-completada',
  CANCELADA: 'badge-cancelada',
  NO_SHOW: 'badge-cancelada',
  REPROGRAMADA: 'badge-reprogramada',
};

const ESTADOS_BLOQUEADOS = ['CANCELADA'];

interface CitaDetalleBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cita: any;
  user: any;
  onEdit: (cita: any) => void;
}

export function CitaDetalleBottomSheet({
  open,
  onOpenChange,
  cita,
  user,
  onEdit,
}: CitaDetalleBottomSheetProps) {
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Monitor status offline
  useEffect(() => {
    const updateOnlineStatus = () => setIsOffline(!navigator.onLine);
    setIsOffline(!navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  if (!cita) return null;

  // ─── Permisos por Rol ──────────────────────────────────────────────────────
  const isAdmin = user?.rol === 'ADMIN';
  const isTechSupport = user?.rol === 'TECH_SUPPORT';
  const isEmpleado = user?.rol === 'EMPLEADO';
  const canEdit = isAdmin || isTechSupport || (isEmpleado && cita.empleado_id === user?.id);
  const canSendCalendar = !ESTADOS_BLOQUEADOS.includes(cita.estado);

  // Prepara los datos reutilizables para compartir
  const { fechaLegible, textoHorario, servicios, profesional, mensajeBase } = buildSharePayload(cita);

  // Acción de Enviar por WhatsApp / Compartir
  const handleEnviarWhatsApp = async () => {
    if (!cita?.id) return;
    if (!cita?.cliente_telefono?.trim()) {
      toast.error('Este cliente fue agendado solamente con nombre y no tiene teléfono registrado.');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/citas/${cita.id}/calendario`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Este cliente fue agendado solamente con nombre y no tiene teléfono registrado.');
        return;
      }

      if (data.waUrl) {
        window.open(data.waUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Fallback a URL de WhatsApp estándar si la API no devuelve una específica
        const encodedMsg = encodeURIComponent(mensajeBase);
        const telClean = cita.cliente_telefono?.replace(/\D/g, '') || '';
        const waUrl = telClean ? `https://wa.me/${telClean}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      toast.error('Error al conectar con el servidor');
    } finally {
      setEnviando(false);
    }
  };

  // Copiar resumen y enlace
  const handleCopiarMensaje = async () => {
    try {
      let textoACopiar = mensajeBase;
      if (cita?.id) {
        const res = await fetch(`/api/citas/${cita.id}/calendario`);
        if (res.ok) {
          const data = await res.json();
          if (data.mensaje) textoACopiar = data.mensaje;
        }
      }

      await navigator.clipboard.writeText(textoACopiar);
      setCopiado(true);
      toast.success('Mensaje y enlace copiados correctamente');
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerOverlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity" />

        <DrawerContent className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl border-t border-border/40 bg-background/98 shadow-2xl backdrop-blur-md outline-none">
          {/* Indicador de Deslizar */}
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30" />

          {/* Offline Banner */}
          {isOffline && (
            <div className="flex items-center justify-center gap-2 bg-amber-500/20 text-amber-500 py-1 px-4 text-xs font-semibold border-b border-amber-500/30">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Modo Sin Conexión</span>
            </div>
          )}

          {/* Header del Detalle */}
          <DrawerHeader className="px-5 py-3 flex items-center justify-between border-b border-border/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div className="text-left">
                <DrawerTitle className="text-sm font-bold text-foreground">
                  Detalle de la Cita
                </DrawerTitle>
                <span
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mt-0.5',
                    ESTADO_BADGE[cita.estado] || 'bg-secondary text-muted-foreground'
                  )}
                >
                  {ESTADO_LABEL[cita.estado] || cita.estado}
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </Button>
          </DrawerHeader>

          {/* Información Compacta */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scrollbar">
            {/* Cliente */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 border border-border/30">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-amber-500" />
              </div>
              <div className="truncate">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cliente</p>
                <p className="text-xs font-bold text-foreground truncate mt-0.5">{cita.cliente_nombre}</p>
              </div>
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/20 border border-border/30">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4 text-blue-500" />
                </div>
                <div className="truncate">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fecha</p>
                  <p className="text-xs font-semibold text-foreground truncate mt-0.5">{fechaLegible}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/20 border border-border/30">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="truncate">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horario</p>
                  <p className="text-xs font-semibold text-foreground truncate mt-0.5">{textoHorario}</p>
                </div>
              </div>
            </div>

            {/* Profesional */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 border border-border/30">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                <Scissors className="w-4 h-4 text-purple-500" />
              </div>
              <div className="truncate">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Atendido por</p>
                <p className="text-xs font-bold text-foreground truncate mt-0.5">{profesional}</p>
              </div>
            </div>

            {/* Servicios */}
            {servicios.length > 0 && (
              <div className="p-3 rounded-xl bg-secondary/15 border border-border/20">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Servicios</p>
                <div className="flex flex-wrap gap-1.5">
                  {servicios.map((nombre, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-foreground border border-amber-500/20 font-medium"
                    >
                      {nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Acciones Rápidas */}
          <DrawerFooter className="p-4 border-t border-border/40 bg-background/95 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
            {canSendCalendar && (
              cita.cliente_telefono ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleEnviarWhatsApp}
                    disabled={enviando || isOffline}
                    className="h-11 text-xs font-bold bg-[#25D366] hover:bg-[#1ebe5a] text-white shadow-md active:scale-[0.98] gap-1.5"
                  >
                    {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                    Enviar a cliente
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleCopiarMensaje}
                    className="h-11 text-xs font-semibold active:scale-[0.98] gap-1.5 border-border/50"
                  >
                    {copiado ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiado ? 'Copiado' : 'Copiar info'}
                  </Button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] font-medium text-amber-700 dark:text-amber-300 text-center leading-relaxed">
                  Este cliente fue agendado solamente con nombre y no tiene teléfono registrado.
                </div>
              )
            )}

            {canEdit && (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(cita);
                }}
                className="w-full h-11 text-xs font-bold border-amber-500/30 text-amber-500 hover:bg-amber-500/10 active:scale-[0.98]"
              >
                <Edit className="w-3.5 h-3.5 mr-2" />
                Editar cita
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
