// components/citas/CitaResumenModal.tsx
// Vista resumida de una cita con botón "Editar" y "Enviar al calendario".
// Respeta permisos: solo muestra acciones permitidas al rol del usuario.
// No muestra IDs, auditoría, precios, códigos internos ni datos sensibles.

'use client';

import { useState } from 'react';
import {
  X,
  CalendarPlus,
  Edit,
  User,
  Clock,
  CalendarDays,
  Scissors,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn, formatTo12h } from '@/lib/utils';
import { formatDBDateLong } from '@/lib/timezone';
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

// Estados que NO permiten enviar al calendario
const ESTADOS_BLOQUEADOS = ['CANCELADA'];

interface CitaResumenModalProps {
  cita: any;
  user: any;
  onClose: () => void;
  onEdit: (cita: any) => void;
}

export function CitaResumenModal({ cita, user, onClose, onEdit }: CitaResumenModalProps) {
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiad] = useState(false);

  if (!cita) return null;

  // ─── Permisos ──────────────────────────────────────────────────────────────
  const isAdmin = user?.rol === 'ADMIN';
  const isTechSupport = user?.rol === 'TECH_SUPPORT';
  const isEmpleado = user?.rol === 'EMPLEADO';
  const canEdit = isAdmin || isTechSupport || (isEmpleado && cita.empleado_id === user?.id);
  const canSendCalendar = !ESTADOS_BLOQUEADOS.includes(cita.estado);

  // ─── Datos formateados ─────────────────────────────────────────────────────
  const fechaLegible = formatDBDateLong(cita.fecha);
  const horaInicio = formatTo12h(cita.hora);

  // Calcular hora de fin
  const [h, m] = (cita.hora || '00:00').split(':').map(Number);
  const totalMin = h * 60 + m + (cita.duracion || 30);
  const hFin = Math.floor(totalMin / 60);
  const mFin = totalMin % 60;
  const horaFinStr = `${String(hFin).padStart(2, '0')}:${String(mFin).padStart(2, '0')}`;
  const horaFin = formatTo12h(horaFinStr);

  const profesional = cita.empleado?.nombre || '';

  // Obtener servicios reales (sin inventar)
  let servicios: string[] = [];
  if (cita.citaServicios && cita.citaServicios.length > 0) {
    servicios = cita.citaServicios
      .map((cs: any) => cs.servicio?.nombre)
      .filter(Boolean);
  } else if (cita.servicio?.nombre) {
    servicios = [cita.servicio.nombre];
  }

  // ─── Enviar al calendario ──────────────────────────────────────────────────
  const handleEnviarCalendario = async () => {
    setEnviando(true);
    try {
      const res = await fetch(`/api/citas/${cita.id}/calendario`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al generar enlace de calendario');
        return;
      }

      // Abrir WhatsApp con el mensaje
      if (data.waUrl) {
        window.open(data.waUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      toast.error('Error al conectar con el servidor');
    } finally {
      setEnviando(false);
    }
  };

  // ─── Copiar mensaje y vínculo ──────────────────────────────────────────────
  const handleCopiarMensaje = async () => {
    try {
      const res = await fetch(`/api/citas/${cita.id}/calendario`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al generar enlace');
        return;
      }

      await navigator.clipboard.writeText(data.mensaje);
      setCopiad(true);
      toast.success('Mensaje copiado correctamente.');
      setTimeout(() => setCopiad(false), 2500);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="w-full max-w-md relative max-h-[92vh] sm:max-h-[90vh] flex flex-col border-border/50 shadow-2xl rounded-t-3xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl overflow-hidden bg-card">
        
        {/* Tirador táctil superior (indicador de deslizar en móvil) */}
        <div className="w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-0 sm:hidden shrink-0" />

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/40 shrink-0 bg-secondary/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <CalendarDays className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Resumen de Cita</h2>
              <span className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mt-0.5',
                ESTADO_BADGE[cita.estado]
              )}>
                {ESTADO_LABEL[cita.estado] || cita.estado}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Contenido ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 pb-safe custom-scrollbar">

          {/* Cliente */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/20 border border-border/30">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cliente</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{cita.cliente_nombre}</p>
            </div>
          </div>

          {/* Fecha y Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/20 border border-border/30">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <CalendarDays className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fecha</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{fechaLegible}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/20 border border-border/30">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horario</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {horaInicio} – {horaFin}
                </p>
                <p className="text-[10px] text-muted-foreground">{cita.duracion} minutos</p>
              </div>
            </div>
          </div>

          {/* Profesional */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/20 border border-border/30">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Scissors className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Profesional</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{profesional}</p>
            </div>
          </div>

          {/* Servicios (solo si existen) */}
          {servicios.length > 0 && (
            <div className="p-3.5 rounded-xl bg-secondary/10 border border-border/20">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Servicios</p>
              <div className="flex flex-wrap gap-1.5">
                {servicios.map((nombre, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-lg bg-primary/8 text-foreground border border-primary/15 font-medium"
                  >
                    {nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Acciones ── */}
        <div className="shrink-0 border-t border-border/40 p-4 sm:p-5 space-y-2.5 bg-card pb-safe">

          {/* Enviar al calendario / Acciones WhatsApp */}
          {canSendCalendar && (
            <div className="space-y-2">
              {cita.cliente_telefono ? (
                <>
                  <Button
                    onClick={handleEnviarCalendario}
                    disabled={enviando}
                    className="w-full gap-2 h-11 text-sm font-bold bg-[#25D366] hover:bg-[#1ebe5a] text-white border-0 shadow-lg shadow-[#25D366]/20 active:scale-[0.99] transition-transform"
                  >
                    {enviando ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                    Enviar al calendario
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCopiarMensaje}
                    className="w-full gap-2 h-10 text-xs font-semibold active:scale-[0.99] transition-transform"
                  >
                    {copiado ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar mensaje y vínculo
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[12px] font-medium text-amber-700 dark:text-amber-300 text-center leading-relaxed">
                  Este cliente fue agendado solamente con nombre y no tiene teléfono registrado.
                </div>
              )}
            </div>
          )}

          {/* Editar */}
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                onEdit(cita);
              }}
              className="w-full gap-2 h-11 text-sm font-bold border-primary/30 text-primary hover:bg-primary/10 active:scale-[0.99] transition-transform"
            >
              <Edit className="w-4 h-4" />
              Editar cita
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
