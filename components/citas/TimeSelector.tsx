'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Loader2, Clock, CalendarX2, CheckCircle2, XCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBusinessTodayString, getBusinessNowTime } from '@/lib/timezone';
import {
  ALL_HOURS_12,
  NORMAL_MINUTES,
  hour12To24h,
  parse24hToNormal,
  formatHora12h,
} from '@/lib/time-utils';

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
  selectedTime: string; // Formato 24h "HH:MM"
  onTimeSelect: (time: string) => void;
  excludeCitaId?: string | null;
  canUseCustomTime?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, minutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
        motivo: `${int.motivo} (${formatHora12h(minutesToTime(int.inicio))} - ${formatHora12h(minutesToTime(int.fin))})`
      };
    }
  }

  return { valida: true, motivo: 'Disponible' };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TimeSelector({
  empleadoId,
  fecha,
  servicioId,
  duracionTotal,
  selectedTime,
  onTimeSelect,
  excludeCitaId,
  canUseCustomTime = true,
}: TimeSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [intervalosOcupados, setIntervalosOcupados] = useState<IntervaloOcupado[]>([]);
  const [businessNow, setBusinessNow] = useState('');

  const duracion = duracionTotal || 30;

  // Desglosar la hora 24h actual seleccionada
  const parsedTime = useMemo(() => {
    return parse24hToNormal(selectedTime || '08:00');
  }, [selectedTime]);

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

  // ─── Fetch Disponibilidad ───────────────────────────────────────────────
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
        if (excludeCitaId) query.append('exclude_cita_id', excludeCitaId);

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

          // ─── AUTO-SELECCIÓN: si no hay hora seleccionada, elegir el primer bloque disponible
          if (!selectedTime) {
            const primerDisponible = (data.bloques || []).find((b: { hora: string; disponible: boolean }) => b.disponible);
            if (primerDisponible) {
              onTimeSelect(primerDisponible.hora);
            } else if (data.jornada?.inicio) {
              onTimeSelect(data.jornada.inicio);
            } else {
              onTimeSelect('08:00');
            }
          }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoId, fecha, servicioId, duracionTotal, excludeCitaId]);

  // ─── Derived state ──────────────────────────────────────────────────────
  const jornadaInicioMin = jornada ? timeToMinutes(jornada.inicio) : 480; // 08:00 default
  const jornadaFinMin = jornada ? timeToMinutes(jornada.fin) : 1080;     // 18:00 default

  const selectedMinutes = selectedTime ? timeToMinutes(selectedTime) : -1;

  const validacionActual = useMemo(() => {
    if (!selectedTime || !jornada) return null;
    return validarLocal(selectedMinutes, duracion, jornadaInicioMin, jornadaFinMin, intervalosOcupados, true);
  }, [selectedTime, selectedMinutes, duracion, jornadaInicioMin, jornadaFinMin, intervalosOcupados, jornada]);

  const isPastTime = useMemo(() => {
    if (!selectedTime) return false;
    const todayStr = getBusinessTodayString();
    if (fecha < todayStr) return true;
    if (fecha === todayStr) {
      const nowTime = getBusinessNowTime();
      return selectedTime < nowTime;
    }
    return false;
  }, [fecha, selectedTime, businessNow]);

  // ─── Manejadores de Cambio de Hora / Minutos / Período ──────────────────
  const handleSelectHour = useCallback((h12: number) => {
    const targetPeriod: 'AM' | 'PM' = parsedTime.period;
    const time24 = hour12To24h(h12, parsedTime.minute, targetPeriod);
    onTimeSelect(time24);
  }, [parsedTime.minute, parsedTime.period, onTimeSelect]);

  const handleSelectMinute = useCallback((m: number) => {
    const time24 = hour12To24h(parsedTime.hour12, m, parsedTime.period);
    onTimeSelect(time24);
  }, [parsedTime.hour12, parsedTime.period, onTimeSelect]);

  const handleSelectPeriod = useCallback((period: 'AM' | 'PM') => {
    const time24 = hour12To24h(parsedTime.hour12, parsedTime.minute, period);
    onTimeSelect(time24);
  }, [parsedTime.hour12, parsedTime.minute, onTimeSelect]);

  // ─── Componentes de Estado ──────────────────────────────────────────────
  if (!empleadoId || !fecha) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-2xl text-muted-foreground bg-secondary/10">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm text-center">Selecciona un profesional y una fecha para ver la disponibilidad horaria.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-border rounded-2xl bg-secondary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Verificando agenda y colisiones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/40 rounded-2xl text-red-600 dark:text-red-400">
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
      <div className="space-y-1.5 pt-2">
        <div className="relative h-9 bg-emerald-100/60 dark:bg-emerald-900/15 rounded-xl overflow-hidden border border-emerald-200/50 dark:border-emerald-800/20">
          {/* Intervalos ocupados */}
          {intervalosOcupados.map((int, i) => {
            const left = Math.max(0, ((int.inicio - jornadaInicioMin) / jornadaDuracion) * 100);
            const width = Math.min(100 - left, ((int.fin - int.inicio) / jornadaDuracion) * 100);
            return (
              <div
                key={i}
                className="absolute top-0 h-full bg-red-500/25 dark:bg-red-500/20 border-x border-red-400/40 dark:border-red-600/30"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${int.motivo}: ${formatHora12h(minutesToTime(int.inicio))} - ${formatHora12h(minutesToTime(int.fin))}`}
              >
                <div
                  className="w-full h-full opacity-30"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px)'
                  }}
                />
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
                  title={`Hora actual: ${formatHora12h(businessNow)}`}
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
              <div
                className={cn(
                  "absolute top-0 h-full transition-all duration-300",
                  validacionActual?.valida
                    ? "bg-primary/25 dark:bg-primary/20 border-x border-primary/50"
                    : "bg-red-500/25 dark:bg-red-500/20 border-x border-red-500/50"
                )}
                style={{
                  left: `${((selectedMinutes - jornadaInicioMin) / jornadaDuracion) * 100}%`,
                  width: `${Math.min(100 - ((selectedMinutes - jornadaInicioMin) / jornadaDuracion) * 100, (duracion / jornadaDuracion) * 100)}%`
                }}
              />
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
                {formatHora12h(minutesToTime(h)).replace(':00', '')}
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/40 border border-border/50 text-xs text-muted-foreground">
          <Clock className="w-4 h-4 shrink-0 text-amber-500" />
          <span>Selecciona la hora de la cita</span>
        </div>
      );
    }

    if (!validacionActual) return null;

    return (
      <div className="flex flex-col gap-1.5 w-full animate-in fade-in duration-200">
        {/* Aviso de Hora Pasada */}
        {isPastTime && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>La hora elegida ya pasó en la fecha actual.</span>
          </div>
        )}

        {/* Mensaje de Restricción si el usuario no tiene permisos fuera de horario */}
        {!canUseCustomTime && !parsedTime.isNormalRange && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>No tienes permiso para agendar citas fuera del horario normal.</span>
          </div>
        )}

        {/* Card de Disponibilidad y Horario */}
        {validacionActual.valida ? (
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Horario Disponible
              </span>
            </div>
            <span className="text-emerald-700 dark:text-emerald-300 font-bold tabular-nums">
              {formatHora12h(selectedTime)} – {formatHora12h(minutesToTime(selectedMinutes + duracion))} ({duracion} min)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 dark:bg-red-950/30 border border-red-500/30 text-xs">
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            <div>
              <span className="font-bold text-red-600 dark:text-red-400">
                Conflicto de agenda
              </span>
              <span className="text-red-600/80 dark:text-red-400/80 ml-1">
                — {validacionActual.motivo}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Selector Unificado de Hora ────────────────────────────────────────
  const renderUnifiedSelector = () => {
    return (
      <div className="space-y-4">
        {/* Banner Informativo y Badge de Rango */}
        <div className="flex items-center justify-between text-[11px] bg-secondary/30 px-3 py-2 rounded-xl border border-border/40">
          <span className="text-muted-foreground">
            Jornada normal: <strong className="text-foreground">8:00 AM – 6:00 PM</strong>
          </span>
          {parsedTime.isNormalRange ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-3 h-3 text-emerald-500" /> Horario normal
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3 text-amber-500" /> Fuera del horario normal
            </span>
          )}
        </div>

        {/* ── Visual Display: Horas (1-12) | Minutos (00-45) | Selector AM/PM ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-secondary/20 p-4 rounded-2xl border border-border/50">
          
          {/* Selector de Hora 12h (1..12) */}
          <div className="flex flex-col items-center sm:items-start gap-1.5 w-full sm:w-auto">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Hora</span>
            <div className="grid grid-cols-6 sm:grid-cols-6 gap-1 w-full max-w-[320px]">
              {ALL_HOURS_12.map((h) => {
                const isSelected = parsedTime.hour12 === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleSelectHour(h)}
                    className={cn(
                      "h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer active:scale-95",
                      isSelected
                        ? parsedTime.isNormalRange
                          ? "bg-amber-500 text-black shadow-md shadow-amber-500/30 scale-105 ring-2 ring-amber-500/50"
                          : "bg-amber-600 text-white shadow-md shadow-amber-600/40 scale-105 ring-2 ring-amber-600/50"
                        : "bg-card hover:bg-secondary/70 text-foreground border border-border/60"
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden sm:block text-2xl font-black text-muted-foreground/60 border-l border-border/40 h-16 my-auto mx-1" />

          {/* Selector de Minutos (00, 15, 30, 45) */}
          <div className="flex flex-col items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Minutos</span>
            <div className="grid grid-cols-4 sm:grid-cols-2 gap-1.5 w-full max-w-[200px]">
              {NORMAL_MINUTES.map((m) => {
                const isSelected = parsedTime.minute === m;
                const mStr = String(m).padStart(2, '0');
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMinute(m)}
                    className={cn(
                      "h-10 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center cursor-pointer active:scale-95",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                        : "bg-card hover:bg-secondary/70 text-foreground border border-border/60"
                    )}
                  >
                    :{mStr}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden sm:block text-2xl font-black text-muted-foreground/60 border-l border-border/40 h-16 my-auto mx-1" />

          {/* Selector Interactivo AM / PM */}
          <div className="flex flex-col items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Período</span>
            <div className="flex bg-card p-1 rounded-xl border border-border/60 shadow-xs">
              <button
                type="button"
                onClick={() => handleSelectPeriod('AM')}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer active:scale-95",
                  parsedTime.period === 'AM'
                    ? "bg-amber-500 text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handleSelectPeriod('PM')}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer active:scale-95",
                  parsedTime.period === 'PM'
                    ? "bg-amber-500 text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                PM
              </button>
            </div>
          </div>
        </div>

        {/* Previsualización Formateada */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Hora seleccionada:{' '}
            <strong className="text-foreground text-sm bg-secondary/40 px-2.5 py-1 rounded-md border border-border/40 tabular-nums">
              {formatHora12h(selectedTime)}
            </strong>
          </p>
        </div>
      </div>
    );
  };

  // ─── Render Principal ───────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Banner de Estado */}
      {renderStatusBanner()}

      {/* Selector Horario Unificado */}
      {renderUnifiedSelector()}

      {/* Línea de tiempo visual */}
      {renderTimeline()}

      {/* Info footer */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 pt-1.5 border-t border-border/20">
        <span>
          {jornada && `Jornada del estilista: ${formatHora12h(jornada.inicio)} – ${formatHora12h(jornada.fin)}`}
        </span>
        <span>
          {fecha.split('-').reverse().join('/')}
        </span>
      </div>
    </div>
  );
}
