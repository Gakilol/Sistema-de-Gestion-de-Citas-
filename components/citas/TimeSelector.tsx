'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Loader2, Clock, CalendarX2, CheckCircle2, XCircle, ChevronUp, ChevronDown, Minus, Plus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBusinessTodayString, getBusinessNowTime } from '@/lib/timezone';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TimeBlock {
  hora: string;
  disponible: boolean;
  motivo: string;
}

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
  const [bloques, setBloques] = useState<TimeBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [intervalosOcupados, setIntervalosOcupados] = useState<IntervaloOcupado[]>([]);
  const [modo, setModo] = useState<'slots' | 'picker'>('slots');
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

  // ─── Fetch Disponibilidad ───────────────────────────────────────────────
  useEffect(() => {
    if (!empleadoId || !fecha) {
      setBloques([]);
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
          setBloques([]);
          setJornada(null);
          setIntervalosOcupados([]);
        } else {
          setBloques(data.bloques || []);
          setJornada(data.jornada || null);
          setIntervalosOcupados(data.intervalosOcupados || []);
        }
      } catch (err: any) {
        setError(err.message);
        setBloques([]);
        setJornada(null);
        setIntervalosOcupados([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDisponibilidad();
  }, [empleadoId, fecha, servicioId, duracionTotal]);

  // ─── Derived state ──────────────────────────────────────────────────────
  const jornadaInicioMin = jornada ? timeToMinutes(jornada.inicio) : 0;
  const jornadaFinMin = jornada ? timeToMinutes(jornada.fin) : 0;

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

  const disponiblesCount = useMemo(() => bloques.filter(b => b.disponible).length, [bloques]);

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
        <p className="text-sm text-center">Selecciona un empleado y una fecha para ver los horarios disponibles.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-border rounded-xl bg-secondary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Calculando espacios disponibles...</p>
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

  if (bloques.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-border rounded-xl bg-secondary/10 text-muted-foreground">
        <CalendarX2 className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm font-medium">No hay horarios registrados para este día.</p>
      </div>
    );
  }

  // ─── Separate morning / afternoon ───────────────────────────────────────
  const bloquesDisponibles = bloques.filter(b => b.disponible);
  const mañana = bloquesDisponibles.filter(b => parseInt(b.hora.split(':')[0]) < 12);
  const tarde = bloquesDisponibles.filter(b => parseInt(b.hora.split(':')[0]) >= 12);

  // ─── Timeline Rendering ────────────────────────────────────────────────
  const jornadaDuracion = jornadaFinMin - jornadaInicioMin;

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
        {/* Timeline bar */}
        <div className="relative h-10 bg-emerald-100/60 dark:bg-emerald-900/20 rounded-lg overflow-hidden border border-emerald-200/60 dark:border-emerald-800/30">
          {/* Occupied intervals */}
          {intervalosOcupados.map((int, i) => {
            const left = Math.max(0, ((int.inicio - jornadaInicioMin) / jornadaDuracion) * 100);
            const width = Math.min(100 - left, ((int.fin - int.inicio) / jornadaDuracion) * 100);
            return (
              <div
                key={i}
                className="absolute top-0 h-full bg-red-400/30 dark:bg-red-500/25 border-x border-red-300/50 dark:border-red-600/30"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${int.motivo}: ${minutesToTime(int.inicio)} - ${minutesToTime(int.fin)}`}
              >
                <div className="w-full h-full opacity-40" style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 6px)'
                }} />
              </div>
            );
          })}

          {/* Real-time current time indicator line */}
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

          {/* Selected time indicator */}
          {selectedTime && selectedMinutes >= jornadaInicioMin && (
            <>
              {/* Duration projection */}
              <div
                className={cn(
                  "absolute top-0 h-full transition-all duration-300",
                  validacionActual?.valida
                    ? "bg-primary/20 dark:bg-primary/15 border-x border-primary/40"
                    : "bg-red-500/20 dark:bg-red-500/15 border-x border-red-500/40"
                )}
                style={{
                  left: `${((selectedMinutes - jornadaInicioMin) / jornadaDuracion) * 100}%`,
                  width: `${Math.min(100 - ((selectedMinutes - jornadaInicioMin) / jornadaDuracion) * 100, (duracion / jornadaDuracion) * 100)}%`
                }}
              />
              {/* Position marker */}
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

        {/* Hour marks */}
        <div className="relative h-4">
          {hourMarks.map(h => {
            const pos = ((h - jornadaInicioMin) / jornadaDuracion) * 100;
            if (pos < 0 || pos > 100) return null;
            return (
              <span
                key={h}
                className="absolute text-[10px] text-muted-foreground font-medium -translate-x-1/2"
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

  // ─── Availability Status Banner ─────────────────────────────────────────
  const renderStatusBanner = () => {
    if (!selectedTime) {
      return (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-secondary/40 border border-border/50 text-sm text-muted-foreground">
          <Clock className="w-4 h-4 shrink-0 opacity-60" />
          <span>Selecciona una hora para verificar disponibilidad</span>
        </div>
      );
    }

    if (!validacionActual) return null;

    if (validacionActual.valida) {
      return (
        <div className="flex flex-col gap-2 w-full">
          {isHorarioEspecial && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs glow-gold font-medium animate-in fade-in duration-200">
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
              <span>Cita en horario especial (fuera de jornada laboral)</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
            <div>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                ✓ Horario disponible
              </span>
              <span className="text-emerald-600/80 dark:text-emerald-400/70 ml-1.5">
                — {formatHora12(selectedTime)} a {formatHora12(minutesToTime(selectedMinutes + duracion))}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
        <XCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
        <div>
          <span className="font-semibold text-red-700 dark:text-red-400">
            ✕ No disponible
          </span>
          <span className="text-red-600/80 dark:text-red-400/70 ml-1.5 text-xs">
            — {validacionActual.motivo}
          </span>
        </div>
      </div>
    );
  };

  // ─── Slots Grid (Smart Slots) ──────────────────────────────────────────
  const renderSlotsGrid = (blocks: TimeBlock[], label: string, dotColor: string) => {
    if (blocks.length === 0) return null;
    return (
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
          {label}
        </h4>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
          {blocks.map((bloque) => {
            const isSelected = selectedTime === bloque.hora;
            return (
              <button
                key={bloque.hora}
                type="button"
                onClick={() => onTimeSelect(bloque.hora)}
                className={cn(
                  "py-2 px-1 text-sm font-medium rounded-lg transition-all duration-200 border",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/20 scale-[1.03]"
                    : "bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:shadow-sm active:scale-95"
                )}
              >
                {formatHora12(bloque.hora)}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Precision Time Picker ─────────────────────────────────────────────
  const renderTimePicker = () => {
    const currentH = selectedTime ? Math.floor(selectedMinutes / 60) : Math.floor(jornadaInicioMin / 60);
    const currentM = selectedTime ? selectedMinutes % 60 : 0;
    const h12 = currentH === 0 ? 12 : currentH > 12 ? currentH - 12 : currentH;
    const isPM = currentH >= 12;

    const toggleAmPm = () => {
      const newH = isPM ? currentH - 12 : currentH + 12;
      if (newH >= 0 && newH <= 23) {
        setHour(newH);
      }
    };

    const cycleHourUp = () => {
      const newH = currentH >= 23 ? 0 : currentH + 1;
      setHour(newH);
    };

    const cycleHourDown = () => {
      const newH = currentH <= 0 ? 23 : currentH - 1;
      setHour(newH);
    };

    return (
      <div className="space-y-4">
        {/* Digital time display */}
        <div className="flex items-center justify-center gap-1">
          {/* Hour Column */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={cycleHourUp}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <div className="w-16 h-14 flex items-center justify-center rounded-xl bg-card border border-border shadow-sm text-2xl font-bold tabular-nums text-foreground">
              {String(h12).padStart(2, '0')}
            </div>
            <button
              type="button"
              onClick={cycleHourDown}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          <span className="text-2xl font-bold text-muted-foreground mx-0.5 self-center">:</span>

          {/* Minute Column */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => {
                const newM = currentM >= 59 ? 0 : currentM + 1;
                setMinute(newM);
              }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <div className="w-16 h-14 flex items-center justify-center rounded-xl bg-card border border-border shadow-sm text-2xl font-bold tabular-nums text-foreground">
              {String(currentM).padStart(2, '0')}
            </div>
            <button
              type="button"
              onClick={() => {
                const newM = currentM <= 0 ? 59 : currentM - 1;
                setMinute(newM);
              }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* AM/PM toggle button */}
          <div className="ml-2 self-center">
            <button
              type="button"
              onClick={toggleAmPm}
              className={cn(
                "text-xs font-bold px-2.5 py-1.5 rounded-md transition-all duration-200 cursor-pointer border active:scale-95",
                isPM
                  ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-900/50"
              )}
              title="Clic para alternar AM/PM"
            >
              {isPM ? 'PM' : 'AM'}
            </button>
          </div>
        </div>

        {/* Quick adjustment buttons */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {[-15, -5, -1, 1, 5, 15].map(delta => (
            <button
              key={delta}
              type="button"
              onClick={() => adjustTime(delta)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all active:scale-95",
                delta < 0
                  ? "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
              )}
            >
              <span className="flex items-center gap-0.5">
                {delta < 0 ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {Math.abs(delta)}m
              </span>
            </button>
          ))}
        </div>

        {/* 12h formatted display */}
        {selectedTime && (
          <p className="text-center text-sm text-muted-foreground">
            Hora seleccionada:{' '}
            <span className="font-bold text-foreground">{formatHora12(selectedTime)}</span>
            {validacionActual?.valida && (
              <span className="text-emerald-600 dark:text-emerald-400"> → {formatHora12(minutesToTime(selectedMinutes + duracion))}</span>
            )}
          </p>
        )}
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Status Banner */}
      {renderStatusBanner()}

      {/* Timeline */}
      {renderTimeline()}

      {/* Mode Switcher */}
      <div className="flex items-center gap-1 p-0.5 bg-secondary/40 rounded-lg border border-border/50 w-fit">
        <button
          type="button"
          onClick={() => setModo('slots')}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
            modo === 'slots'
              ? "bg-card text-foreground shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-1.5">
            <Zap className="w-3 h-3" />
            Rápido
          </span>
        </button>
        <button
          type="button"
          onClick={() => setModo('picker')}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
            modo === 'picker'
              ? "bg-card text-foreground shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Hora exacta
          </span>
        </button>
      </div>

      {/* Content */}
      {modo === 'slots' ? (
        <div className="space-y-3">
          {disponiblesCount === 0 ? (
            <div className="flex flex-col items-center justify-center p-4 border border-border rounded-xl bg-secondary/10 text-muted-foreground">
              <CalendarX2 className="w-6 h-6 mb-1.5 opacity-50" />
              <p className="text-xs font-medium">No hay horarios rápidos disponibles.</p>
              <button
                type="button"
                onClick={() => setModo('picker')}
                className="text-xs text-primary font-semibold mt-1 hover:underline"
              >
                Probar con hora exacta →
              </button>
            </div>
          ) : (
            <>
              {renderSlotsGrid(mañana, 'Mañana', 'bg-amber-400')}
              {renderSlotsGrid(tarde, 'Tarde / Noche', 'bg-indigo-400')}
            </>
          )}
        </div>
      ) : (
        renderTimePicker()
      )}

      {/* Info footer */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 pt-1 border-t border-border/30">
        <span>
          {jornada && `Jornada: ${formatHora12(jornada.inicio)} – ${formatHora12(jornada.fin)}`}
        </span>
        <span>
          {disponiblesCount} horario{disponiblesCount !== 1 ? 's' : ''} rápido{disponiblesCount !== 1 ? 's' : ''} disponible{disponiblesCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
