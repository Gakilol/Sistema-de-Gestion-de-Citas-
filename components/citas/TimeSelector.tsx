'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Loader2, Clock, CalendarX2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBusinessTodayString, getBusinessNowTime } from '@/lib/timezone';

// ─── Types ──────────────────────────────────────────────────────────────────

interface IntervaloOcupado {
  inicio: number;
  fin: number;
  motivo: string;
}

interface Jornada {
  inicio: string;
  fin: string;
  activo?: boolean;
}

interface TimeSelectorProps {
  empleadoId: string;
  fecha: string;
  servicioId?: string;
  duracionTotal?: number;
  selectedTime: string;
  onTimeSelect: (time: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatHora12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function validarLocal(
  startMin: number,
  duracion: number,
  jornadaInicioMin: number,
  jornadaFinMin: number,
  intervalos: IntervaloOcupado[],
  permitirHorarioExtendido: boolean = true
): { valida: boolean; motivo: string } {
  const endMin = startMin + duracion;

  if (!permitirHorarioExtendido) {
    if (startMin < jornadaInicioMin) {
      return { valida: false, motivo: `Antes del inicio de jornada (${minutesToTime(jornadaInicioMin)})` };
    }
    if (endMin > jornadaFinMin) {
      return { valida: false, motivo: `Excede el fin de jornada (${minutesToTime(jornadaFinMin)})` };
    }
  }

  for (const int of intervalos) {
    if (startMin < int.fin && endMin > int.inicio) {
      return {
        valida: false,
        motivo: `${int.motivo} (${minutesToTime(int.inicio)} - ${minutesToTime(int.fin)})`
      };
    }
  }

  return { valida: true, motivo: 'Disponible' };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TimeSelector({ empleadoId, fecha, servicioId, duracionTotal, selectedTime, onTimeSelect }: TimeSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [intervalosOcupados, setIntervalosOcupados] = useState<IntervaloOcupado[]>([]);
  const [businessNow, setBusinessNow] = useState('');

  const duracion = duracionTotal || 30;

  useEffect(() => {
    setBusinessNow(getBusinessNowTime());
    const interval = setInterval(() => {
      setBusinessNow(getBusinessNowTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const isToday = useMemo(() => {
    return fecha === getBusinessTodayString();
  }, [fecha]);

  // ─── Fetch Disponibilidad (Solo intervalos y jornada) ───────────────────
  useEffect(() => {
    if (!empleadoId || !fecha) {
      setJornada(null);
      setIntervalosOcupados([]);
      return;
    }

    const fetchDisponibilidad = async () => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ fecha });
        if (servicioId) query.append('servicio_id', servicioId);
        if (duracionTotal) query.append('duracion_total', duracionTotal.toString());

        const res = await fetch(`/api/empleados/${empleadoId}/disponibilidad?${query.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Error al cargar disponibilidad');
        }

        if (!data.disponible && data.bloques.length === 0) {
          setError(data.motivo || 'No disponible este día');
          setJornada(null);
          setIntervalosOcupados([]);
        } else {
          setJornada(data.jornada || null);
          setIntervalosOcupados(data.intervalosOcupados || []);
        }
      } catch (err: any) {
        setError(err.message);
        setJornada(null);
        setIntervalosOcupados([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDisponibilidad();
  }, [empleadoId, fecha, servicioId, duracionTotal]);

  // ─── Derived state ──────────────────────────────────────────────────────
  const jornadaInicioMin = jornada ? timeToMinutes(jornada.inicio) : 480; // 08:00 default
  const jornadaFinMin = jornada ? timeToMinutes(jornada.fin) : 1080;     // 18:00 default

  const selectedMinutes = selectedTime ? timeToMinutes(selectedTime) : -1;

  const validacionActual = useMemo(() => {
    if (!selectedTime || !jornada) return null;
    return validarLocal(selectedMinutes, duracion, jornadaInicioMin, jornadaFinMin, intervalosOcupados, true);
  }, [selectedTime, selectedMinutes, duracion, jornadaInicioMin, jornadaFinMin, intervalosOcupados, jornada]);

  const isHorarioEspecial = useMemo(() => {
    if (!selectedTime || !jornada) return false;
    const isDiaInactivo = jornada.activo === false;
    const outsideJornada = selectedMinutes < jornadaInicioMin || (selectedMinutes + duracion) > jornadaFinMin;
    return isDiaInactivo || outsideJornada;
  }, [selectedTime, selectedMinutes, duracion, jornada, jornadaInicioMin, jornadaFinMin]);

  // ─── Time Picker Handlers ──────────────────────────────────────────────
  const adjustTime = useCallback((deltaMinutes: number) => {
    let newMinutes: number;
    if (selectedTime) {
      newMinutes = selectedMinutes + deltaMinutes;
    } else {
      newMinutes = jornadaInicioMin;
    }

    // Permitir cualquier hora del día (00:00 a 23:59)
    newMinutes = Math.max(0, Math.min(1439, newMinutes));
    onTimeSelect(minutesToTime(newMinutes));
  }, [selectedTime, selectedMinutes, jornadaInicioMin, onTimeSelect]);

  const setHour = useCallback((h: number) => {
    const currentM = selectedTime ? selectedMinutes % 60 : 0;
    const newMinutes = h * 60 + currentM;
    onTimeSelect(minutesToTime(Math.max(0, Math.min(1439, newMinutes))));
  }, [selectedTime, selectedMinutes, onTimeSelect]);

  const setMinute = useCallback((m: number) => {
    const currentH = selectedTime ? Math.floor(selectedMinutes / 60) : Math.floor(jornadaInicioMin / 60);
    const newMinutes = currentH * 60 + m;
    onTimeSelect(minutesToTime(Math.max(0, Math.min(1439, newMinutes))));
  }, [selectedTime, selectedMinutes, jornadaInicioMin, onTimeSelect]);

  // ─── Empty / Loading / Error States ─────────────────────────────────────
  if (!empleadoId || !fecha) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl text-muted-foreground bg-secondary/10">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm text-center">Selecciona un empleado y una fecha para ver la agenda horaria.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-border rounded-xl bg-secondary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Consultando agenda y colisiones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/40 rounded-xl text-red-600 dark:text-red-400">
        <CalendarX2 className="w-8 h-8 mb-2 opacity-80" />
        <p className="font-semibold text-center">{error}</p>
        <p className="text-xs text-red-500 dark:text-red-400/70 mt-1">Intenta seleccionando otra fecha.</p>
      </div>
    );
  }

  // ─── Timeline Rendering ────────────────────────────────────────────────
  const jornadaDuracion = Math.max(60, jornadaFinMin - jornadaInicioMin);

  const renderTimeline = () => {
    if (!jornada || jornadaDuracion <= 0) return null;

    const hourMarks: number[] = [];
    const startHour = Math.ceil(jornadaInicioMin / 60);
    const endHour = Math.floor(jornadaFinMin / 60);
    for (let h = startHour; h <= endHour; h++) {
      hourMarks.push(h * 60);
    }

    return (
      <div className="space-y-1.5">
        {/* Barra de tiempo de la Línea de Tiempo */}
        <div className="relative h-10 bg-emerald-100/60 dark:bg-emerald-900/10 rounded-lg overflow-hidden border border-emerald-200/50 dark:border-emerald-800/20">
          {/* Intervalos ocupados */}
          {intervalosOcupados.map((int, i) => {
            const left = Math.max(0, ((int.inicio - jornadaInicioMin) / jornadaDuracion) * 100);
            const width = Math.min(100 - left, ((int.fin - int.inicio) / jornadaDuracion) * 100);
            return (
              <div
                key={i}
                className="absolute top-0 h-full bg-red-400/30 dark:bg-red-500/20 border-x border-red-300/40 dark:border-red-600/20"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${int.motivo}: ${minutesToTime(int.inicio)} - ${minutesToTime(int.fin)}`}
              >
                <div className="w-full h-full opacity-30" style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 6px)'
                }} />
              </div>
            );
          })}

          {/* Línea indicadora de hora actual */}
          {isToday && businessNow && (() => {
            const nowMin = timeToMinutes(businessNow);
            const currentPercentage = ((nowMin - jornadaInicioMin) / jornadaDuracion) * 100;
            if (currentPercentage >= 0 && currentPercentage <= 100) {
              return (
                <div
                  className="absolute top-0 w-0.5 h-full bg-amber-500 z-10 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  style={{ left: `${currentPercentage}%` }}
                  title={`Hora actual: ${formatHora12(businessNow)}`}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-500" />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-500" />
                </div>
              );
            }
            return null;
          })()}

          {/* Indicador de Hora Seleccionada y Proyección de Duración */}
          {selectedTime && selectedMinutes >= 0 && (
            <>
              {/* Proyección basada en la duración */}
              <div
                className={cn(
                  "absolute top-0 h-full transition-all duration-300",
                  validacionActual?.valida
                    ? "bg-primary/20 dark:bg-primary/15 border-x border-primary/45"
                    : "bg-red-500/20 dark:bg-red-500/15 border-x border-red-500/40"
                )}
                style={{
                  left: `${((selectedMinutes - jornadaInicioMin) / jornadaDuracion) * 100}%`,
                  width: `${Math.min(100 - ((selectedMinutes - jornadaInicioMin) / jornadaDuracion) * 100, (duracion / jornadaDuracion) * 100)}%`
                }}
              />
              {/* Marcador de inicio */}
              <div
                className={cn(
                  "absolute top-0 w-0.5 h-full transition-all duration-300 shadow-sm",
                  validacionActual?.valida ? "bg-primary" : "bg-red-500"
                )}
                style={{ left: `${((selectedMinutes - jornadaInicioMin) / jornadaDuracion) * 100}%` }}
              >
                <div className={cn(
                  "absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 shadow-md",
                  validacionActual?.valida
                    ? "bg-primary border-primary-foreground"
                    : "bg-red-500 border-white"
                )} />
              </div>
            </>
          )}
        </div>

        {/* Marcas horarias legibles */}
        <div className="relative h-4">
          {hourMarks.map(h => {
            const pos = ((h - jornadaInicioMin) / jornadaDuracion) * 100;
            if (pos < 0 || pos > 100) return null;
            return (
              <span
                key={h}
                className="absolute text-[10px] text-muted-foreground font-semibold -translate-x-1/2"
                style={{ left: `${pos}%` }}
              >
                {formatHora12(minutesToTime(h)).replace(':00', '')}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Banner de Estado de Disponibilidad ──────────────────────────────────
  const renderStatusBanner = () => {
    if (!selectedTime) {
      return (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-secondary/40 border border-border/50 text-xs text-muted-foreground">
          <Clock className="w-4 h-4 shrink-0 opacity-60 text-primary" />
          <span>Ajusta la hora para validar colisiones de horario en tiempo real</span>
        </div>
      );
    }

    if (!validacionActual) return null;

    if (validacionActual.valida) {
      return (
        <div className="flex flex-col gap-2 w-full">
          {isHorarioEspecial && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-semibold animate-in fade-in duration-200">
              <span className="animate-pulse">⚡</span>
              <span>Horario especial: fuera de la jornada laboral habitual</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 dark:border-emerald-800/30 text-xs animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                ✓ Disponible
              </span>
              <span className="text-emerald-600/80 dark:text-emerald-400/70 ml-1.5">
                ({formatHora12(selectedTime)} – {formatHora12(minutesToTime(selectedMinutes + duracion))})
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-red-500/10 dark:bg-red-950/20 border border-red-500/30 dark:border-red-800/30 text-xs animate-in fade-in duration-200">
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        <div>
          <span className="font-bold text-red-600 dark:text-red-400">
            ✕ Conflicto detected
          </span>
          <span className="text-red-600/80 dark:text-red-400/70 ml-1.5">
            — {validacionActual.motivo}
          </span>
        </div>
      </div>
    );
  };

  // ─── Dropdown Time Picker ──────────────────────────────────────────────────
  const renderTimePicker = () => {
    const currentH = selectedTime ? Math.floor(selectedMinutes / 60) : Math.floor(jornadaInicioMin / 60);
    const currentM = selectedTime ? selectedMinutes % 60 : 0;
    const h12      = currentH === 0 ? 12 : currentH > 12 ? currentH - 12 : currentH;
    const isPM     = currentH >= 12;

    const handleHourChange = (val: string) => {
      const h12New  = parseInt(val, 10);
      const h24New  = isPM
        ? (h12New === 12 ? 12 : h12New + 12)
        : (h12New === 12 ? 0 : h12New);
      setHour(h24New);
    };

    const handleMinuteChange = (val: string) => {
      setMinute(parseInt(val, 10));
    };

    const handlePeriodChange = (val: string) => {
      const wantPM = val === 'PM';
      if (wantPM && !isPM) {
        const newH = currentH + 12;
        if (newH <= 23) setHour(newH);
      } else if (!wantPM && isPM) {
        const newH = currentH - 12;
        if (newH >= 0) setHour(newH);
      }
    };

    // Calcular hora fin para el panel
    const horaFinMin = selectedTime ? selectedMinutes + duracion : -1;
    const horaFinStr = horaFinMin >= 0 ? minutesToTime(Math.min(1439, horaFinMin)) : null;

    return (
      <div className="space-y-4">
        {/* ─── Panel de Información de Tiempo ────────────────────────────── */}
        {selectedTime && (
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-secondary/30 border border-border/50">
            <div className="text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Inicio</p>
              <p className="text-sm font-bold text-foreground tabular-nums">{formatHora12(selectedTime)}</p>
            </div>
            <div className="text-center border-x border-border/40">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Duración</p>
              <p className="text-sm font-bold text-primary tabular-nums">{duracion} min</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Fin</p>
              <p className={cn(
                "text-sm font-bold tabular-nums",
                validacionActual?.valida ? "text-emerald-500" : "text-red-500"
              )}>
                {horaFinStr ? formatHora12(horaFinStr) : '--'}
              </p>
            </div>
          </div>
        )}

        {/* ─── Selectores de Hora / Minuto / Período ──────────────────────── */}
        <div className="flex items-center justify-center gap-2">
          {/* Selector de Hora (1–12) */}
          <div className="flex flex-col items-center gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hora</label>
            <select
              value={String(h12).padStart(2, '0')}
              onChange={e => handleHourChange(e.target.value)}
              className="w-16 h-11 text-center text-xl font-bold rounded-xl bg-card border border-border shadow-sm text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                <option key={h} value={String(h).padStart(2, '0')}>
                  {String(h).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          <span className="text-2xl font-bold text-muted-foreground self-end mb-2">:</span>

          {/* Selector de Minuto (00–59) */}
          <div className="flex flex-col items-center gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Min</label>
            <select
              value={String(currentM).padStart(2, '0')}
              onChange={e => handleMinuteChange(e.target.value)}
              className="w-16 h-11 text-center text-xl font-bold rounded-xl bg-card border border-border shadow-sm text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none"
            >
              {Array.from({ length: 60 }, (_, i) => i).map(m => (
                <option key={m} value={String(m).padStart(2, '0')}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Período AM/PM */}
          <div className="flex flex-col items-center gap-1 ml-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Período</label>
            <select
              value={isPM ? 'PM' : 'AM'}
              onChange={e => handlePeriodChange(e.target.value)}
              className={cn(
                "w-16 h-11 text-center text-sm font-bold rounded-xl border shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none transition-colors",
                isPM
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-500"
              )}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Banner de Estado */}
      {renderStatusBanner()}

      {/* Selector Horario Digital Preciso */}
      {renderTimePicker()}

      {/* Línea de tiempo visual */}
      {renderTimeline()}

      {/* Info footer */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 pt-1.5 border-t border-border/20">
        <span>
          {jornada && `Jornada del estilista: ${formatHora12(jornada.inicio)} – ${formatHora12(jornada.fin)}`}
        </span>
        <span>
          {fecha.split('-').reverse().join('/')}
        </span>
      </div>
    </div>
  );
}
