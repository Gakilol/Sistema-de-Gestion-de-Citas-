// components/citas/AgendaCalendario.tsx
'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Users, Scissors, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgendaCalendarioProps {
  citas: any[];
  empleados: any[];
  filtroEmpleado: string;
  scope: string;
  user: any;
  onEditCita: (cita: any) => void;
  /** Llamado cuando el usuario termina de seleccionar un slot (click o drag) */
  onSlotClick: (params: { date: string; time: string; empleadoId: string; durationMinutes: number }) => void;
  selectedDateStr: string;
  setSelectedDateStr: (date: string) => void;
  isLoading?: boolean;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_SEMANA_ABR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Configuración de la cuadrícula de horas (de 7:00 a 20:00)
const HORA_INICIO = 7; // 7 AM
const HORA_FIN = 20;   // 8 PM
const TOTAL_HORAS = HORA_FIN - HORA_INICIO + 1;
const HOUR_HEIGHT = 80; // 1 hora = 80px
const SLOT_HEIGHT = HOUR_HEIGHT / 4; // 15 min = 20px
const MIN_HEIGHT = 42;  // 42px min height to prevent tiny text

// Duración mínima y máxima de selección por drag
const MIN_DRAG_MINUTES = 15;
const MAX_DRAG_MINUTES = (HORA_FIN - HORA_INICIO) * 60; // hasta el fin del día

// Umbral para distinguir scroll normal de drag (en px, solo para touch)
const TOUCH_DRAG_THRESHOLD = 8;

// ─── Utilidades de tiempo ────────────────────────────────────────────────────

/** Snap a múltiplos de 15 minutos */
const snapTo15 = (minutes: number) => Math.round(minutes / 15) * 15;

/** Convierte una posición Y dentro de una columna a minutos desde medianoche */
const yToMinutes = (y: number): number => {
  const rawMinutes = (y / HOUR_HEIGHT) * 60;
  const totalMinutes = HORA_INICIO * 60 + rawMinutes;
  const snapped = snapTo15(totalMinutes);
  return Math.min(Math.max(HORA_INICIO * 60, snapped), HORA_FIN * 60);
};

/** Convierte minutos desde medianoche a posición Y en px */
const minutesToY = (minutes: number): number =>
  ((minutes - HORA_INICIO * 60) / 60) * HOUR_HEIGHT;

/** Formatea minutos desde medianoche a "HH:MM" 24h */
const minutesToTimeStr = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Formatea "HH:MM" a "H:MM AM/PM" */
const formatTime12h = (timeStr: string): string => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${m} ${ampm}`;
};

/** Formatea minutos desde medianoche a "H:MM AM/PM" directamente */
const minutesToLabel = (minutes: number): string =>
  formatTime12h(minutesToTimeStr(minutes));

// ─── Estado de drag (interno al componente vía ref, sin re-renders) ──────────
interface DragStateRef {
  active: boolean;
  dayStr: string;
  empleadoId: string;
  startMinutes: number;
  currentMinutes: number;
  pointerId: number;
  startY: number;       // Y inicial del pointer (para umbral touch)
  thresholdMet: boolean; // si ya superó el umbral de 8px
}

// ─── Estado visual del ghost block (renderizado, sí usa useState) ────────────
interface GhostBlock {
  dayStr: string;
  empleadoId: string;
  topPx: number;
  heightPx: number;
  startLabel: string;
  endLabel: string;
  durationMin: number;
}

export function AgendaCalendario({
  citas,
  empleados,
  filtroEmpleado,
  scope,
  user,
  onEditCita,
  onSlotClick,
  selectedDateStr,
  setSelectedDateStr,
  isLoading = false,
}: AgendaCalendarioProps) {
  const [vista, setVista] = useState<'dia' | '3dias' | 'semana'>('dia');
  const [hoveredSlot, setHoveredSlot] = useState<{ dayStr: string; empleadoId: string; top: number; timeLabel: string } | null>(null);
  const [ghostBlock, setGhostBlock] = useState<GhostBlock | null>(null);

  // Ref de estado de drag — mutable sin re-renders durante el arrastre
  const dragRef = useRef<DragStateRef>({
    active: false,
    dayStr: '',
    empleadoId: '',
    startMinutes: 0,
    currentMinutes: 0,
    pointerId: -1,
    startY: 0,
    thresholdMet: false,
  });

  // Helper para convertir YYYY-MM-DD local a objeto Date de forma segura
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Helper para formatear objeto Date a YYYY-MM-DD local
  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const fechaBase = useMemo(() => parseLocalDate(selectedDateStr), [selectedDateStr]);

  // Filtrar empleados según el rol y filtros del admin/scope
  const empleadosColumnas = useMemo(() => {
    if (user?.rol === 'EMPLEADO' || scope === 'mine') {
      return empleados.filter((e) => e.id === user?.id);
    }
    if (filtroEmpleado) {
      return empleados.filter((e) => e.id === filtroEmpleado);
    }
    return empleados.filter((e) => e.activo);
  }, [empleados, filtroEmpleado, user, scope]);

  // Obtener rango de días según la vista seleccionada
  const diasAMostrar = useMemo(() => {
    const dias: Date[] = [];
    if (vista === 'dia') {
      dias.push(new Date(fechaBase));
    } else if (vista === '3dias') {
      for (let i = 0; i < 3; i++) {
        const d = new Date(fechaBase);
        d.setDate(fechaBase.getDate() + i);
        dias.push(d);
      }
    } else if (vista === 'semana') {
      const d = new Date(fechaBase);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const lunes = new Date(d.setDate(diff));
      for (let i = 0; i < 7; i++) {
        const temp = new Date(lunes);
        temp.setDate(lunes.getDate() + i);
        dias.push(temp);
      }
    }
    return dias;
  }, [fechaBase, vista]);

  const tituloCabecera = useMemo(() => {
    if (diasAMostrar.length === 0) return '';
    const primerDia = diasAMostrar[0];
    const ultimoDia = diasAMostrar[diasAMostrar.length - 1];
    if (primerDia.getMonth() === ultimoDia.getMonth()) {
      return `${MESES[primerDia.getMonth()]} ${primerDia.getFullYear()}`;
    }
    return `${MESES[primerDia.getMonth()]} - ${MESES[ultimoDia.getMonth()]} ${primerDia.getFullYear()}`;
  }, [diasAMostrar]);

  const cambiarFecha = (offset: number) => {
    const nuevaFecha = new Date(fechaBase);
    if (vista === 'dia') {
      nuevaFecha.setDate(fechaBase.getDate() + offset);
    } else if (vista === '3dias') {
      nuevaFecha.setDate(fechaBase.getDate() + offset * 3);
    } else if (vista === 'semana') {
      nuevaFecha.setDate(fechaBase.getDate() + offset * 7);
    }
    setSelectedDateStr(formatLocalDate(nuevaFecha));
  };

  const irAHoy = () => {
    setSelectedDateStr(formatLocalDate(new Date()));
  };

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  // Generar lista de horas para la regla lateral
  const horasRegla = useMemo(() => {
    const lista = [];
    for (let i = HORA_INICIO; i <= HORA_FIN; i++) {
      const hStr = String(i).padStart(2, '0') + ':00';
      lista.push({
        raw: hStr,
        label: formatTime12h(hStr),
      });
    }
    return lista;
  }, []);

  // Filtrar citas para los días a mostrar
  const citasPorDia = useMemo(() => {
    const mapa: Record<string, any[]> = {};
    diasAMostrar.forEach((dia) => {
      const diaStr = formatLocalDate(dia);
      mapa[diaStr] = [];
    });

    citas.forEach((cita) => {
      const fechaCitaStr = new Date(cita.fecha).toISOString().split('T')[0];
      if (mapa[fechaCitaStr]) {
        mapa[fechaCitaStr].push(cita);
      }
    });

    return mapa;
  }, [citas, diasAMostrar]);

  // Contar citas visibles en el periodo
  const totalCitasVisibles = useMemo(() => {
    let count = 0;
    Object.values(citasPorDia).forEach((lista) => {
      count += lista.length;
    });
    return count;
  }, [citasPorDia]);

  // Algoritmo de posicionamiento de bloques superpuestos (Google Calendar)
  const procesarCitasDia = (citasDia: any[]) => {
    if (!citasDia || citasDia.length === 0) return [];

    const parsed = citasDia.map(cita => {
      const minInicio = timeToMinutes(cita.hora);
      const minFin = minInicio + (cita.duracion || 30);
      return { ...cita, minInicio, minFin };
    });

    parsed.sort((a, b) => {
      if (a.minInicio !== b.minInicio) return a.minInicio - b.minInicio;
      return b.duracion - a.duracion;
    });

    const clusters: any[][] = [];
    let currentCluster: any[] = [];
    let maxEnd = 0;

    parsed.forEach((cita) => {
      if (cita.minInicio >= maxEnd) {
        if (currentCluster.length > 0) clusters.push(currentCluster);
        currentCluster = [cita];
        maxEnd = cita.minFin;
      } else {
        currentCluster.push(cita);
        if (cita.minFin > maxEnd) maxEnd = cita.minFin;
      }
    });
    if (currentCluster.length > 0) clusters.push(currentCluster);

    const result: any[] = [];

    clusters.forEach((cluster) => {
      const columns: any[][] = [];

      cluster.forEach((cita) => {
        let colIndex = 0;
        while (true) {
          if (!columns[colIndex]) columns[colIndex] = [];
          const col = columns[colIndex];
          const lastInCol = col[col.length - 1];
          if (!lastInCol || cita.minInicio >= lastInCol.minFin) {
            col.push(cita);
            cita.colIndex = colIndex;
            break;
          }
          colIndex++;
        }
      });

      const totalColumns = columns.length;
      cluster.forEach((cita) => {
        cita.totalColumns = totalColumns;
        const minCero = HORA_INICIO * 60;
        const topPx = Math.max(0, (cita.minInicio - minCero) * (HOUR_HEIGHT / 60));
        const heightPx = Math.max(MIN_HEIGHT, (cita.duracion || 30) * (HOUR_HEIGHT / 60));
        result.push({ ...cita, topPx, heightPx });
      });
    });

    return result;
  };

  const totalSubColumnas = useMemo(() => {
    return diasAMostrar.length * empleadosColumnas.length;
  }, [diasAMostrar, empleadosColumnas]);

  const minGridWidth = useMemo(() => {
    if (vista === 'dia') {
      return totalSubColumnas > 3 ? `${totalSubColumnas * 160}px` : '100%';
    }
    return `${Math.max(650, totalSubColumnas * 120)}px`;
  }, [vista, totalSubColumnas]);

  // ─── Lógica de Drag-to-Select ─────────────────────────────────────────────

  /** Calcula el ghost block a partir del estado de drag actual */
  const computeGhostBlock = useCallback((drag: DragStateRef): GhostBlock | null => {
    if (!drag.active || !drag.thresholdMet) return null;

    const startMin = drag.startMinutes;
    const endMin = drag.currentMinutes;

    // Normalizar inicio < fin
    const minStart = Math.min(startMin, endMin);
    const minEnd = Math.max(startMin, endMin);

    const duration = minEnd - minStart;
    if (duration < MIN_DRAG_MINUTES) return null;

    const topPx = minutesToY(minStart);
    const heightPx = minutesToY(minEnd) - topPx;

    return {
      dayStr: drag.dayStr,
      empleadoId: drag.empleadoId,
      topPx,
      heightPx: Math.max(SLOT_HEIGHT, heightPx),
      startLabel: minutesToLabel(minStart),
      endLabel: minutesToLabel(minEnd),
      durationMin: duration,
    };
  }, []);

  /** Cancela el drag en curso */
  const cancelDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag.active && drag.pointerId >= 0) {
      // Intentamos liberar el puntero en la columna capturada
      try {
        const el = document.querySelector(`[data-drag-col="${drag.dayStr}-${drag.empleadoId}"]`) as HTMLElement;
        if (el) el.releasePointerCapture(drag.pointerId);
      } catch {}
    }
    dragRef.current = {
      active: false,
      dayStr: '',
      empleadoId: '',
      startMinutes: 0,
      currentMinutes: 0,
      pointerId: -1,
      startY: 0,
      thresholdMet: false,
    };
    setGhostBlock(null);
    setHoveredSlot(null);
  }, []);

  /** Cancelar drag con Escape */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current.active) {
        cancelDrag();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelDrag]);

  // ─── Handlers de Pointer Events para cada columna ────────────────────────

  const handlePointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    dayStr: string,
    empleadoId: string,
  ) => {
    // Ignorar si el click es sobre una cita existente
    const isOverBooking = (e.target as HTMLElement).closest('.booking-card');
    if (isOverBooking) return;

    // Solo botón primario (izquierdo / dedo)
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const startMin = yToMinutes(y);

    // Capturar el pointer para recibir move/up aunque el cursor salga del elemento
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    dragRef.current = {
      active: true,
      dayStr,
      empleadoId,
      startMinutes: startMin,
      currentMinutes: startMin,
      pointerId: e.pointerId,
      startY: e.clientY,
      thresholdMet: e.pointerType !== 'touch', // mouse y stylus activan inmediatamente
    };

    // Para mouse: activar ghost inmediatamente (sin esperar umbral)
    if (e.pointerType !== 'touch') {
      setGhostBlock({
        dayStr,
        empleadoId,
        topPx: minutesToY(startMin),
        heightPx: SLOT_HEIGHT,
        startLabel: minutesToLabel(startMin),
        endLabel: minutesToLabel(startMin + MIN_DRAG_MINUTES),
        durationMin: MIN_DRAG_MINUTES,
      });
    }

    // Ocultar hover guide durante drag
    setHoveredSlot(null);
  }, []);

  const handlePointerMove = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    dayStr: string,
    empleadoId: string,
  ) => {
    const drag = dragRef.current;

    // ── Hover guide (cuando no hay drag activo) ──
    if (!drag.active) {
      const isOverBooking = (e.target as HTMLElement).closest('.booking-card');
      if (isOverBooking) {
        setHoveredSlot(null);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const slotMin = yToMinutes(y);
      const topPx = minutesToY(slotMin);
      const hour = Math.floor(slotMin / 60);
      const min = slotMin % 60;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const timeLabel = `${displayHour}:${String(min).padStart(2, '0')} ${ampm}`;
      setHoveredSlot({ dayStr, empleadoId, top: topPx, timeLabel });
      return;
    }

    // Solo procesar si el drag es de esta misma columna
    if (!drag.active || drag.dayStr !== dayStr || drag.empleadoId !== empleadoId) return;

    // ── Umbral para touch: necesita moverse 8px antes de activar drag ──
    if (!drag.thresholdMet) {
      const deltaY = Math.abs(e.clientY - drag.startY);
      if (deltaY < TOUCH_DRAG_THRESHOLD) return;
      dragRef.current.thresholdMet = true;
    }

    // Prevenir scroll de página mientras se arrastra en móvil
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const currentMin = yToMinutes(Math.max(0, Math.min(y, rect.height)));

    dragRef.current.currentMinutes = currentMin;

    // Actualizar ghost block
    const newGhost = computeGhostBlock(dragRef.current);
    setGhostBlock(newGhost);
  }, [computeGhostBlock]);

  const handlePointerUp = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    dayStr: string,
    empleadoId: string,
  ) => {
    const drag = dragRef.current;

    // Si no había drag activo en esta columna, tratar como click simple
    if (!drag.active || drag.dayStr !== dayStr || drag.empleadoId !== empleadoId) {
      cancelDrag();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const endMin = yToMinutes(Math.max(0, Math.min(y, rect.height)));

    const startMin = drag.startMinutes;
    const finalStart = Math.min(startMin, endMin);
    const finalEnd = Math.max(startMin, endMin);
    let duration = finalEnd - finalStart;

    // Duración mínima de 15 minutos (incluso en click simple)
    if (duration < MIN_DRAG_MINUTES) duration = MIN_DRAG_MINUTES;

    // Limpiar estado de drag
    const wasDragging = drag.thresholdMet && (finalEnd - finalStart) >= MIN_DRAG_MINUTES;
    cancelDrag();

    // Solo abrir modal si hubo al menos un drag real o click
    onSlotClick({
      date: dayStr,
      time: minutesToTimeStr(finalStart),
      empleadoId,
      durationMinutes: duration,
    });
  }, [cancelDrag, onSlotClick]);

  const handlePointerCancel = useCallback(() => {
    cancelDrag();
  }, [cancelDrag]);

  const handleMouseLeave = useCallback((dayStr: string, empleadoId: string) => {
    if (!dragRef.current.active) {
      setHoveredSlot(null);
    }
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[750px] border border-border/50 rounded-2xl bg-card overflow-hidden shadow-lg select-none relative">
      
      {/* CABECERA DEL CALENDARIO (CONTROLES) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-border/50 bg-secondary/15 z-30">
        
        {/* Controles de Navegación */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={irAHoy} className="font-semibold gap-1 text-xs hover-lift cursor-pointer h-9">
            <CalendarIcon className="w-3.5 h-3.5" /> Hoy
          </Button>
          <div className="flex items-center border border-border rounded-lg bg-background shadow-sm h-9">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none cursor-pointer" onClick={() => cambiarFecha(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-bold px-3 border-x border-border py-1 text-foreground min-w-[130px] text-center">
              {tituloCabecera}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none cursor-pointer" onClick={() => cambiarFecha(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          {scope === 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 animate-pulse uppercase tracking-wider">
              <Users className="w-3 h-3 shrink-0" /> Agenda Global
            </span>
          )}
        </div>

        {/* Hint de drag */}
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/60 font-medium">
          <GripVertical className="w-3 h-3" />
          <span>Arrastra para seleccionar horario</span>
        </div>

        {/* Toggles de Vista */}
        <div className="flex bg-secondary/30 p-1 rounded-xl border border-border/40 self-start sm:self-auto shadow-inner h-10 items-center">
          {[
            { id: 'dia', label: 'Día' },
            { id: '3dias', label: '3 Días' },
            { id: 'semana', label: 'Semana' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setVista(tab.id as any)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                vista === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm font-bold scale-[1.02]"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENEDOR DE GRID Y HORAS (SCROLL) */}
      <div className="flex-1 overflow-auto relative custom-scrollbar bg-background/5">
        
        {/* Envoltorio con Ancho Mínimo */}
        <div
          className="flex flex-col h-full min-h-[850px]"
          style={{ minWidth: minGridWidth }}
        >
          {/* CABECERA DE DÍAS Y EMPLEADOS (Sticky top) */}
          <div className="flex sticky top-0 bg-card border-b border-border/40 z-30 shadow-sm">
            {/* Esquina superior izquierda */}
            <div className="w-16 md:w-20 shrink-0 sticky left-0 bg-card border-r border-border/40 z-40 flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider" />
            
            {/* Columnas de nombres de días y empleados */}
            <div className="flex-1 flex">
              {diasAMostrar.map((dia, dIdx) => {
                const esHoy = formatLocalDate(dia) === formatLocalDate(new Date());
                return (
                  <div
                    key={dIdx}
                    className={cn(
                      "flex-1 flex flex-col border-r border-border/20 last:border-r-0",
                      esHoy && "bg-primary/[0.02] text-primary"
                    )}
                  >
                    {/* Header del Día */}
                    <div className="py-2 text-center border-b border-border/20 bg-secondary/10 flex flex-col items-center justify-center min-w-[90px]">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground/80 tracking-wider">
                        {DIAS_SEMANA_ABR[dia.getDay()]}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-extrabold w-6 h-6 flex items-center justify-center rounded-full mt-0.5 transition-all",
                          esHoy && "bg-primary text-primary-foreground shadow-md scale-105"
                        )}
                      >
                        {dia.getDate()}
                      </span>
                    </div>

                    {/* Sub-headers de Empleados */}
                    <div className="flex divide-x divide-border/10">
                      {empleadosColumnas.map((emp) => (
                        <div
                          key={emp.id}
                          className="flex-1 py-1.5 text-center text-[10px] font-bold text-muted-foreground truncate px-1"
                        >
                          {emp.nombre.split(' ')[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GRID DEL CALENDARIO */}
          <div className="flex relative flex-1" style={{ height: `${TOTAL_HORAS * HOUR_HEIGHT}px` }}>
            
            {/* Columna lateral de Horas (sticky left) */}
            <div className="w-16 md:w-20 shrink-0 border-r border-border/40 bg-card/90 select-none relative z-20">
              {horasRegla.map((hora, idx) => (
                <div
                  key={idx}
                  className="relative text-right pr-2 text-[10px] font-bold text-muted-foreground"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="absolute -top-2.5 right-2 bg-background px-1 rounded shadow-sm border border-border/10 text-[9px] font-bold">
                    {hora.label.replace(':00', '').replace(' p. m.', ' PM').replace(' a. m.', ' AM')}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid principal */}
            <div className="flex-1 flex relative">
              
              {/* Líneas horizontales de fondo */}
              <div className="absolute inset-0 pointer-events-none select-none z-0">
                {Array.from({ length: TOTAL_HORAS }).map((_, idx) => (
                  <div
                    key={idx}
                    className="border-b border-border/20 w-full"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  />
                ))}
              </div>

              {/* Líneas de cuartos de hora (más sutiles) */}
              <div className="absolute inset-0 pointer-events-none select-none z-0">
                {Array.from({ length: TOTAL_HORAS * 4 }).map((_, idx) => {
                  if (idx % 4 === 0) return null; // ya cubierto por la línea de hora
                  return (
                    <div
                      key={idx}
                      className="border-b border-border/[0.08] w-full"
                      style={{ height: `${SLOT_HEIGHT}px` }}
                    />
                  );
                })}
              </div>

              {/* Renderizado de Columnas de Citas por Día y Empleado */}
              {diasAMostrar.map((dia, dIdx) => {
                const diaStr = formatLocalDate(dia);
                const citasDiaTodos = citasPorDia[diaStr] || [];
                const esHoy = diaStr === formatLocalDate(new Date());

                return (
                  <div
                    key={dIdx}
                    className={cn(
                      "flex-1 flex divide-x divide-border/10 border-r border-border/20 last:border-r-0 h-full relative z-10",
                      esHoy && "bg-primary/[0.01]"
                    )}
                  >
                    {empleadosColumnas.map((emp) => {
                      const citasDiaRaw = citasDiaTodos.filter((cita) => cita.empleado_id === emp.id);
                      const citasDia = procesarCitasDia(citasDiaRaw);

                      const isGhostHere = ghostBlock?.dayStr === diaStr && ghostBlock?.empleadoId === emp.id;
                      const isHoverHere = hoveredSlot?.dayStr === diaStr && hoveredSlot?.empleadoId === emp.id;
                      const isDraggingHere = dragRef.current.active && dragRef.current.dayStr === diaStr && dragRef.current.empleadoId === emp.id;

                      return (
                        <div
                          key={emp.id}
                          data-drag-col={`${diaStr}-${emp.id}`}
                          className={cn(
                            "flex-1 relative h-full min-w-[80px] transition-colors duration-150",
                            isDraggingHere
                              ? "bg-primary/[0.04] cursor-ns-resize"
                              : "cursor-pointer hover:bg-primary/[0.02]"
                          )}
                          style={{
                            // Prevenir scroll durante drag en móvil
                            touchAction: isDraggingHere ? 'none' : 'auto',
                          }}
                          onPointerDown={(e) => handlePointerDown(e, diaStr, emp.id)}
                          onPointerMove={(e) => handlePointerMove(e, diaStr, emp.id)}
                          onPointerUp={(e) => handlePointerUp(e, diaStr, emp.id)}
                          onPointerCancel={handlePointerCancel}
                          onMouseLeave={() => handleMouseLeave(diaStr, emp.id)}
                        >
                          {/* ── Ghost Block (Drag Preview) ── */}
                          {isGhostHere && ghostBlock && (
                            <div
                              className="absolute left-1 right-1 z-20 pointer-events-none overflow-hidden"
                              style={{
                                top: `${ghostBlock.topPx}px`,
                                height: `${ghostBlock.heightPx}px`,
                              }}
                            >
                              {/* Fondo glassmorphism */}
                              <div className="absolute inset-0 rounded-xl border-2 border-dashed border-primary/70 bg-primary/15 dark:bg-primary/20 backdrop-blur-[2px] shadow-lg shadow-primary/10" />
                              
                              {/* Barra lateral izquierda */}
                              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-primary/80" />

                              {/* Contenido del ghost block */}
                              <div className="relative z-10 flex flex-col items-center justify-center h-full px-2 gap-0.5">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-primary shrink-0" />
                                  <span className="text-[10px] font-black text-primary leading-tight">
                                    {ghostBlock.startLabel}
                                    {ghostBlock.durationMin >= MIN_DRAG_MINUTES && (
                                      <> – {ghostBlock.endLabel}</>
                                    )}
                                  </span>
                                </div>
                                {ghostBlock.heightPx >= 32 && (
                                  <span className="text-[9px] font-bold text-primary/80 leading-tight">
                                    {ghostBlock.durationMin} min
                                  </span>
                                )}
                              </div>

                              {/* Handle de arrastre inferior */}
                              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-primary/40" />
                            </div>
                          )}

                          {/* ── Hover Guide (cuando no hay drag) ── */}
                          {isHoverHere && !ghostBlock && hoveredSlot && (
                            <div
                              className="absolute left-1 right-1 rounded-lg border border-primary/30 bg-primary/5 pointer-events-none z-[1] flex items-center justify-center transition-all duration-75 animate-in fade-in zoom-in-95"
                              style={{
                                top: `${hoveredSlot.top}px`,
                                height: `${HOUR_HEIGHT / 2}px`,
                              }}
                            >
                              <span className="text-[10px] font-bold text-primary opacity-80 flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" /> Agendar {hoveredSlot.timeLabel}
                              </span>
                            </div>
                          )}

                          {/* ── Citas de este día para este estilista ── */}
                          {citasDia.map((cita) => {
                            const { topPx, heightPx, colIndex, totalColumns } = cita;
                            const catColor = cita.servicio?.categoriaRel?.color || '#3b82f6';
                            
                            const widthPct = 100 / totalColumns;
                            const leftPct = colIndex * widthPct;
                            const gapPx = 1.5;

                            const isSmall = heightPx < 48;
                            const isMedium = heightPx >= 48 && heightPx < 78;
                            const isLarge = heightPx >= 78;

                            let tooltipText = `${cita.cliente_nombre}\nHora: ${formatTime12h(cita.hora)} (${cita.duracion} min)\nServicio: ${cita.servicio?.nombre || 'N/A'}\nEstilista: ${cita.empleado?.nombre || 'N/A'}`;
                            if (cita.allowOverlap) {
                              tooltipText += `\n[Traslape Confirmado: ${cita.overlapReason || 'Sin motivo'}]`;
                            }

                            return (
                              <div
                                key={cita.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditCita(cita);
                                }}
                                title={tooltipText}
                                className="booking-card absolute p-2 rounded-xl border text-left cursor-pointer transition-all duration-200 overflow-hidden flex flex-col group hover:shadow-lg hover:scale-[1.01] hover:z-30 select-none active:scale-[0.99]"
                                style={{
                                  top: `${topPx}px`,
                                  height: `${heightPx}px`,
                                  left: `calc(${leftPct}% + ${gapPx}px)`,
                                  width: `calc(${widthPct}% - ${gapPx * 2}px)`,
                                  backgroundColor: cita.allowOverlap 
                                    ? `color-mix(in srgb, ${catColor} 8%, color-mix(in srgb, #f59e0b 5%, var(--color-card)))` 
                                    : `color-mix(in srgb, ${catColor} 10%, var(--color-card))`,
                                  borderColor: cita.allowOverlap ? '#d97706' : `color-mix(in srgb, ${catColor} 28%, var(--color-border))`,
                                  borderStyle: cita.allowOverlap ? 'dashed' : 'solid',
                                  borderWidth: cita.allowOverlap ? '2px' : '1px',
                                  zIndex: 5,
                                }}
                              >
                                {/* Indicador lateral */}
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-all group-hover:w-1.5"
                                  style={{ backgroundColor: catColor }}
                                />

                                {/* Contenido */}
                                <div className="pl-1.5 flex flex-col h-full justify-between overflow-hidden">
                                  <div className="overflow-hidden">
                                    <div className="flex items-center gap-1 overflow-hidden">
                                      {cita.allowOverlap && (
                                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 font-extrabold text-[8px] shrink-0" title={`Traslape controlado: ${cita.overlapReason || 'Sin motivo'}`}>
                                          ⚠️
                                        </span>
                                      )}
                                      <p className="text-[10px] font-extrabold leading-tight text-foreground truncate group-hover:underline">
                                        {cita.cliente_nombre}
                                      </p>
                                    </div>
                                    {cita.allowOverlap && !isSmall && (
                                      <div className="mt-0.5 flex items-center">
                                        <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider scale-95 origin-left" title={cita.overlapReason || 'Traslape autorizado'}>
                                          Intercalada
                                        </span>
                                      </div>
                                    )}
                                    
                                    {isSmall && (
                                      <p className="text-[9px] font-semibold text-foreground/75 truncate mt-0.5">
                                        {formatTime12h(cita.hora)}
                                      </p>
                                    )}

                                    {isMedium && (
                                      <>
                                        <p className="text-[9px] font-semibold text-foreground/75 truncate mt-0.5">
                                          {formatTime12h(cita.hora)} · {cita.duracion}m
                                        </p>
                                        <span className="flex items-center gap-1 mt-1 text-[8px] font-bold text-foreground/70 truncate">
                                          <Scissors className="w-2.5 h-2.5 shrink-0" style={{ color: catColor }} />
                                          {cita.servicio?.nombre}
                                        </span>
                                      </>
                                    )}

                                    {isLarge && (
                                      <>
                                        <p className="text-[9px] font-semibold text-foreground/75 truncate mt-0.5">
                                          {formatTime12h(cita.hora)} · {cita.duracion} min
                                        </p>
                                        <div className="flex flex-col gap-1 mt-1.5 opacity-90 text-[8px] font-medium truncate">
                                          <span className="flex items-center gap-1 text-foreground/80 truncate font-semibold">
                                            <Scissors className="w-2.5 h-2.5 shrink-0" style={{ color: catColor }} />
                                            {cita.servicio?.nombre}
                                          </span>
                                          {scope === 'all' && (
                                            <span className="flex items-center gap-1 text-foreground/75 truncate font-semibold">
                                              <User className="w-2.5 h-2.5 shrink-0" style={{ color: catColor }} />
                                              {cita.empleado?.nombre}
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ESTADO VACÍO */}
        {!isLoading && totalCitasVisibles === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-background/5 pointer-events-none z-10">
            <div className="text-center p-6 max-w-sm bg-card/90 backdrop-blur-[3px] border border-border/80 rounded-2xl shadow-xl pointer-events-auto flex flex-col items-center">
              <CalendarIcon className="w-8 h-8 text-muted-foreground mb-3 animate-bounce" />
              <h3 className="text-sm font-bold text-foreground mb-1">Sin citas programadas</h3>
              <p className="text-xs text-muted-foreground max-w-[250px] leading-relaxed">
                {vista === 'dia' 
                  ? 'No hay citas registradas para este día.' 
                  : `No hay citas registradas para esta ${vista === 'semana' ? 'semana' : 'agenda de 3 días'}.`}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                💡 Haz click o arrastra en el calendario para agendar
              </p>
            </div>
          </div>
        )}

        {/* OVERLAY DE CARGA */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] z-50 flex items-center justify-center transition-all duration-300 animate-in fade-in">
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border shadow-2xl">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-muted-foreground tracking-wide">Cargando agenda...</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
