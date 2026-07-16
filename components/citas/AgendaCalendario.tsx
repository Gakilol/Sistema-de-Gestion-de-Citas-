import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Users, Scissors, Plus, AlertTriangle, GripVertical, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getBusinessTodayString } from '@/lib/timezone';
import {
  HORA_INICIO,
  HORA_FIN,
  TOTAL_HORAS,
  HOUR_HEIGHT,
  SLOT_HEIGHT,
  MIN_HEIGHT,
  MIN_HOUR_HEIGHT,
  DEFAULT_HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  TOUCH_LONG_PRESS_MS,
  TOUCH_MOVE_THRESHOLD,
  MOUSE_MOVE_THRESHOLD,
  CITA_MOVE_LONG_PRESS_MS,
  CITA_MOVE_MOUSE_THRESHOLD,
  MIN_APPOINTMENT_MINUTES,
  RESIZE_HANDLE_PX,
  yToMinutes,
  minutesToY,
  minutesToTimeStr,
  formatTime12h,
  minutesToLabel,
  checkOverlap,
  isCitaEditable,
} from '@/lib/calendar-drag-utils';

interface AgendaCalendarioProps {
  citas: any[];
  empleados: any[];
  filtroEmpleado: string;
  scope: string;
  user: any;
  onEditCita: (cita: any) => void;
  /** Llamado al hacer click en una cita para ver el resumen */
  onViewCita?: (cita: any) => void;
  /** Llamado cuando el usuario termina de seleccionar un slot (click o drag) para CREAR una cita */
  onSlotClick: (params: { date: string; time: string; empleadoId: string; durationMinutes: number }) => void;
  /** Llamado cuando el usuario mueve o redimensiona una cita existente */
  onMoveCita?: (params: {
    citaId: string;
    fecha: string;
    hora: string;
    empleadoId: string;
    duracion: number;
    clientUpdatedAt: string;
  }) => Promise<{ error?: string; type?: string; conflicts?: any[] } | void>;
  /** Overrides optimistas locales: posición visual de citas que están siendo actualizadas */
  localCitaOverrides?: Record<string, { fecha?: string; hora?: string; duracion?: number; empleado_id?: string }>;
  selectedDateStr: string;
  setSelectedDateStr: (date: string) => void;
  isLoading?: boolean;
}

const DIAS_SEMANA_ABR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ─── Estado de drag de CREACIÓN (ref mutable sin re-renders excesivos) ────────
interface DragStateRef {
  active: boolean;
  dayStr: string;
  empleadoId: string;
  startMinutes: number;
  currentMinutes: number;
  pointerId: number;
  startX: number;
  startY: number;
  pointerType: string;
  targetCol: HTMLElement | null;
}

// ─── Estado visual y de interacción del bloque PROVISIONAL de creación ────────
interface ProvisionalSlot {
  dayStr: string;
  empleadoId: string;
  startMin: number;
  endMin: number;
  isOverlap?: boolean;
}

interface ProvisionalDragRef {
  active: boolean;
  mode: 'create' | 'move' | 'resize-top' | 'resize-bottom';
  dayStr: string;
  empleadoId: string;
  originalDayStr: string;
  originalEmpleadoId: string;
  originalStartMin: number;
  originalEndMin: number;
  startMinutes: number;
  grabOffsetY: number;
  pointerId: number;
  startX: number;
  startY: number;
  pointerType: string;
  targetCol: HTMLElement | null;
  pending: boolean;
  wasDragged: boolean;
}

// ─── Estado de drag de MOVIMIENTO de cita existente ──────────────────────────
interface MoveState {
  active: boolean;
  citaId: string;
  cita: any;                 // snapshot original de la cita
  originalDayStr: string;
  originalEmpleadoId: string;
  originalStartMin: number;
  currentDayStr: string;
  currentEmpleadoId: string;
  currentStartMin: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  pointerType: string;
  /** Offset Y en px desde el top de la cita hasta donde el usuario hizo pointerdown */
  grabOffsetY: number;
  targetEl: HTMLElement | null;
  pending: boolean;          // Longpress en espera (touch) o mousedown en espera (mouse)
}

// ─── Estado de resize de cita existente ──────────────────────────────────────
interface ResizeState {
  active: boolean;
  citaId: string;
  cita: any;                 // snapshot original
  handle: 'top' | 'bottom';
  originalStartMin: number;
  originalEndMin: number;
  currentStartMin: number;
  currentEndMin: number;
  dayStr: string;
  empleadoId: string;
  pointerId: number;
  targetEl: HTMLElement | null;
}

// ─── Snackbar de Deshacer ─────────────────────────────────────────────────────
interface SnackbarState {
  visible: boolean;
  message: string;
  citaId: string;
  previousSnapshot: {
    fecha: string;
    hora: string;
    duracion: number;
    empleadoId: string;
    clientUpdatedAt: string;
  };
  timerId: ReturnType<typeof setTimeout> | null;
}

export function AgendaCalendario({
  citas,
  empleados,
  filtroEmpleado,
  scope,
  user,
  onEditCita,
  onViewCita,
  onSlotClick,
  onMoveCita,
  localCitaOverrides = {},
  selectedDateStr,
  setSelectedDateStr,
  isLoading = false,
}: AgendaCalendarioProps) {
  const [vista, setVista] = useState<'dia' | '3dias' | 'semana'>('dia');
  const [hoveredSlot, setHoveredSlot] = useState<{ dayStr: string; empleadoId: string; top: number; timeLabel: string } | null>(null);
  const [provisionalSlot, setProvisionalSlot] = useState<ProvisionalSlot | null>(null);

  // Estado para cita seleccionada (muestra handles de resize)
  const [selectedCitaId, setSelectedCitaId] = useState<string | null>(null);

  // Ghost visual durante MOVIMIENTO de cita existente
  const [moveGhost, setMoveGhost] = useState<{
    topPx: number;
    heightPx: number;
    dayStr: string;
    empleadoId: string;
    startLabel: string;
    endLabel: string;
    isOverlap: boolean;
    catColor: string;
  } | null>(null);

  // Ghost visual durante RESIZE
  const [resizeGhost, setResizeGhost] = useState<{
    topPx: number;
    heightPx: number;
    dayStr: string;
    empleadoId: string;
    startLabel: string;
    endLabel: string;
    durationMin: number;
  } | null>(null);

  // Snackbar de deshacer
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    visible: false,
    message: '',
    citaId: '',
    previousSnapshot: { fecha: '', hora: '', duracion: 0, empleadoId: '', clientUpdatedAt: '' },
    timerId: null,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressPendingRef = useRef<boolean>(false);
  const mousePendingRef = useRef<boolean>(false);

  // ─── Máquina de Estados de Interacción Explosiva (PROMPT 5) ─────────────────
  type CalendarInteractionState =
    | 'idle'
    | 'scrolling'
    | 'selecting'
    | 'moving-selection'
    | 'moving-appointment'
    | 'resizing-start'
    | 'resizing-end'
    | 'pinch-zooming';

  const interactionStateRef = useRef<CalendarInteractionState>('idle');

  const isStateIdleOr = useCallback((...allowedStates: CalendarInteractionState[]) => {
    return (
      interactionStateRef.current === 'idle' ||
      allowedStates.includes(interactionStateRef.current)
    );
  }, []);

  // ─── Estado de Zoom Vertical Interno y Persistencia ────────────────────────
  const [hourHeight, setHourHeight] = useState<number>(DEFAULT_HOUR_HEIGHT);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novacita_calendar_hour_height');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_HOUR_HEIGHT && parsed <= MAX_HOUR_HEIGHT) {
          setHourHeight(parsed);
        }
      }
    }
  }, []);

  const updateHourHeight = useCallback((newHeight: number) => {
    const clamped = Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, Math.round(newHeight)));
    setHourHeight(clamped);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('novacita_calendar_hour_height', String(clamped));
      } catch {}
    }
  }, []);

  // Ref de estado de interacción del bloque PROVISIONAL (creación / movimiento / resize)
  const provisionalDragRef = useRef<ProvisionalDragRef>({
    active: false,
    mode: 'create',
    dayStr: '',
    empleadoId: '',
    originalDayStr: '',
    originalEmpleadoId: '',
    originalStartMin: 0,
    originalEndMin: 0,
    startMinutes: 0,
    grabOffsetY: 0,
    pointerId: -1,
    startX: 0,
    startY: 0,
    pointerType: '',
    targetCol: null,
    pending: false,
    wasDragged: false,
  });

  // Ref de estado de MOVIMIENTO de cita
  const moveRef = useRef<MoveState>({
    active: false,
    citaId: '',
    cita: null,
    originalDayStr: '',
    originalEmpleadoId: '',
    originalStartMin: 0,
    currentDayStr: '',
    currentEmpleadoId: '',
    currentStartMin: 0,
    pointerId: -1,
    startClientX: 0,
    startClientY: 0,
    pointerType: '',
    grabOffsetY: 0,
    targetEl: null,
    pending: false,
  });

  // Ref de estado de RESIZE
  const resizeRef = useRef<ResizeState>({
    active: false,
    citaId: '',
    cita: null,
    handle: 'bottom',
    originalStartMin: 0,
    originalEndMin: 0,
    currentStartMin: 0,
    currentEndMin: 0,
    dayStr: '',
    empleadoId: '',
    pointerId: -1,
    targetEl: null,
  });

  // Long-press timer para movimiento de cita
  const citaLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  // "Pending mouse" para movimiento de cita (igual que el drag de creación)
  const citaMousePendingRef = useRef<boolean>(false);

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

  // Helper para leer la fecha de una cita desde la BD como YYYY-MM-DD (UTC-safe)
  const getCitaDateStr = useCallback((cita: any): string => {
    if (!cita?.fecha) return '';
    const d = new Date(cita.fecha);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const fechaBase = useMemo(() => parseLocalDate(selectedDateStr), [selectedDateStr]);

  const [activeMobileEmpId, setActiveMobileEmpId] = useState<string>('all');

  // ─── Permisos de edición ─────────────────────────────────────────────────────
  const canMoveToOtherEmployee = useCallback((cita: any): boolean => {
    if (!user) return false;
    if (user.rol === 'ADMIN' || user.rol === 'TECH_SUPPORT') return true;
    // EMPLEADO solo puede mover sus propias citas pero NO reasignar a otro
    return false;
  }, [user]);

  const canMoveCita = useCallback((cita: any): boolean => {
    if (!user) return false;
    if (!isCitaEditable(cita.estado)) return false;
    if (user.rol === 'ADMIN' || user.rol === 'TECH_SUPPORT') return true;
    if (user.rol === 'EMPLEADO' && cita.empleado_id === user.id) return true;
    return false;
  }, [user]);

  // Filtrar empleados según el rol y filtros del admin/scope
  const empleadosBase = useMemo(() => {
    const isEligible = (e: any) => (e.activo ?? true) && (e.esAgendable ?? true) && e.rol !== 'TECH_SUPPORT';
    if (user?.rol === 'EMPLEADO' || scope === 'mine') {
      return empleados.filter((e) => e.id === user?.id && isEligible(e));
    }
    if (filtroEmpleado) {
      return empleados.filter((e) => e.id === filtroEmpleado && isEligible(e));
    }
    return empleados.filter(isEligible);
  }, [empleados, filtroEmpleado, user, scope]);

  const empleadosColumnas = useMemo(() => {
    if (activeMobileEmpId !== 'all' && empleadosBase.some(e => e.id === activeMobileEmpId)) {
      return empleadosBase.filter(e => e.id === activeMobileEmpId);
    }
    return empleadosBase;
  }, [empleadosBase, activeMobileEmpId]);

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
    setSelectedDateStr(getBusinessTodayString());
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

  // Filtrar citas para los días a mostrar, aplicando overrides locales optimistas
  const citasConOverrides = useMemo(() => {
    return citas.map(cita => {
      const override = localCitaOverrides[cita.id];
      if (!override) return cita;
      return {
        ...cita,
        hora: override.hora ?? cita.hora,
        duracion: override.duracion ?? cita.duracion,
        empleado_id: override.empleado_id ?? cita.empleado_id,
        // La fecha es un objeto Date en la BD, mantenemos la original
        // pero para comparación usamos override.fecha si existe
        _overrideFecha: override.fecha,
      };
    });
  }, [citas, localCitaOverrides]);

  const citasPorDia = useMemo(() => {
    const mapa: Record<string, any[]> = {};
    diasAMostrar.forEach((dia) => {
      const diaStr = formatLocalDate(dia);
      mapa[diaStr] = [];
    });

    citasConOverrides.forEach((cita) => {
      // Si la cita tiene override de fecha, usar ese
      const fechaStr = cita._overrideFecha || getCitaDateStr(cita);
      if (mapa[fechaStr]) {
        mapa[fechaStr].push(cita);
      }
    });

    return mapa;
  }, [citasConOverrides, diasAMostrar, getCitaDateStr]);

  // Contar citas visibles en el periodo
  const totalCitasVisibles = useMemo(() => {
    let count = 0;
    Object.values(citasPorDia).forEach((lista) => {
      count += lista.length;
    });
    return count;
  }, [citasPorDia]);

  // Algoritmo de posicionamiento de bloques superpuestos (Google Calendar)
  const procesarCitasDia = useCallback((citasDia: any[]) => {
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
        const topPx = Math.max(0, (cita.minInicio - minCero) * (hourHeight / 60));
        const heightPx = Math.max(MIN_HEIGHT, (cita.duracion || 30) * (hourHeight / 60));
        result.push({ ...cita, topPx, heightPx });
      });
    });

    return result;
  }, [hourHeight]);

  const totalSubColumnas = useMemo(() => {
    return diasAMostrar.length * empleadosColumnas.length;
  }, [diasAMostrar, empleadosColumnas]);

  const minGridWidth = useMemo(() => {
    if (vista === 'dia') {
      return totalSubColumnas > 1 ? `${Math.max(340, totalSubColumnas * 140)}px` : '100%';
    }
    return `${Math.max(680, totalSubColumnas * 135)}px`;
  }, [vista, totalSubColumnas]);

  // Si la pantalla es móvil (< 768px), ajustar por defecto la vista a 'dia'
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setVista('dia');
    }
  }, []);

  // ─── Snackbar helpers ─────────────────────────────────────────────────────────
  const dismissSnackbar = useCallback(() => {
    setSnackbar(prev => {
      if (prev.timerId) clearTimeout(prev.timerId);
      return { ...prev, visible: false, timerId: null };
    });
  }, []);

  const showSnackbar = useCallback((message: string, citaId: string, snapshot: SnackbarState['previousSnapshot']) => {
    setSnackbar(prev => {
      if (prev.timerId) clearTimeout(prev.timerId);
      const timerId = setTimeout(() => {
        setSnackbar(s => ({ ...s, visible: false, timerId: null }));
      }, 8000);
      return { visible: true, message, citaId, previousSnapshot: snapshot, timerId };
    });
  }, []);

  // ─── Autoscroll Helper ────────────────────────────────────────────────────────
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  // Limpiar selección provisional al cambiar fecha o vista
  useEffect(() => {
    setProvisionalSlot(null);
  }, [selectedDateStr, vista]);

  /** Cancela cualquier drag de selección provisional o temporizador en curso */
  const cancelDrag = useCallback(() => {
    stopAutoScroll();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPendingRef.current = false;
    mousePendingRef.current = false;

    const pDrag = provisionalDragRef.current;
    if (pDrag.targetCol && pDrag.pointerId >= 0) {
      try {
        pDrag.targetCol.releasePointerCapture(pDrag.pointerId);
      } catch {}
    }

    provisionalDragRef.current = {
      active: false,
      mode: 'create',
      dayStr: '',
      empleadoId: '',
      originalDayStr: '',
      originalEmpleadoId: '',
      originalStartMin: 0,
      originalEndMin: 0,
      startMinutes: 0,
      grabOffsetY: 0,
      pointerId: -1,
      startX: 0,
      startY: 0,
      pointerType: '',
      targetCol: null,
      pending: false,
      wasDragged: false,
    };
    setHoveredSlot(null);
    if (
      interactionStateRef.current === 'selecting' ||
      interactionStateRef.current === 'moving-selection' ||
      interactionStateRef.current === 'scrolling'
    ) {
      interactionStateRef.current = 'idle';
    }
  }, [stopAutoScroll]);

  /** Cancela y elimina por completo el bloque provisional */
  const clearProvisionalSlot = useCallback(() => {
    cancelDrag();
    setProvisionalSlot(null);
  }, [cancelDrag]);

  /** Confirmación explícita: abre el formulario con la selección provisional configurada */
  const handleConfirmProvisional = useCallback(() => {
    if (!provisionalSlot) return;
    const { dayStr, empleadoId, startMin, endMin } = provisionalSlot;
    const durationMinutes = Math.max(15, endMin - startMin);
    onSlotClick({
      date: dayStr,
      time: minutesToTimeStr(startMin),
      empleadoId,
      durationMinutes,
    });
  }, [provisionalSlot, onSlotClick]);

  /** Cancela el movimiento de una cita existente */
  const cancelMove = useCallback(() => {
    stopAutoScroll();
    if (citaLongPressTimerRef.current) {
      clearTimeout(citaLongPressTimerRef.current);
      citaLongPressTimerRef.current = null;
    }
    citaMousePendingRef.current = false;

    const mv = moveRef.current;
    if (mv.targetEl && mv.pointerId >= 0) {
      try { mv.targetEl.releasePointerCapture(mv.pointerId); } catch {}
    }
    moveRef.current = {
      active: false, citaId: '', cita: null,
      originalDayStr: '', originalEmpleadoId: '', originalStartMin: 0,
      currentDayStr: '', currentEmpleadoId: '', currentStartMin: 0,
      pointerId: -1, startClientX: 0, startClientY: 0, pointerType: '',
      grabOffsetY: 0, targetEl: null, pending: false,
    };
    setMoveGhost(null);
    if (interactionStateRef.current === 'moving-appointment' || interactionStateRef.current === 'scrolling') {
      interactionStateRef.current = 'idle';
    }
  }, [stopAutoScroll]);

  /** Cancela el resize de una cita existente */
  const cancelResize = useCallback(() => {
    stopAutoScroll();
    const rs = resizeRef.current;
    if (rs.targetEl && rs.pointerId >= 0) {
      try { rs.targetEl.releasePointerCapture(rs.pointerId); } catch {}
    }
    resizeRef.current = {
      active: false, citaId: '', cita: null, handle: 'bottom',
      originalStartMin: 0, originalEndMin: 0,
      currentStartMin: 0, currentEndMin: 0,
      dayStr: '', empleadoId: '', pointerId: -1, targetEl: null,
    };
    setResizeGhost(null);
    if (interactionStateRef.current === 'resizing-start' || interactionStateRef.current === 'resizing-end') {
      interactionStateRef.current = 'idle';
    }
  }, [stopAutoScroll]);

  /** Limpia todas las interacciones activas */
  const cancelAllInteractions = useCallback(() => {
    cancelDrag();
    cancelMove();
    cancelResize();
    interactionStateRef.current = 'idle';
  }, [cancelDrag, cancelMove, cancelResize]);

  /** Cancelar gestos con Escape, Enter, perdida de foco o cambio de orientación */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelAllInteractions();
        clearProvisionalSlot();
        setSelectedCitaId(null);
      } else if (e.key === 'Enter' && provisionalSlot) {
        handleConfirmProvisional();
      }
    };

    const onWindowInterruption = () => {
      cancelAllInteractions();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowInterruption);
    window.addEventListener('resize', onWindowInterruption);
    window.addEventListener('orientationchange', onWindowInterruption);
    window.addEventListener('pointercancel', onWindowInterruption);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowInterruption);
      window.removeEventListener('resize', onWindowInterruption);
      window.removeEventListener('orientationchange', onWindowInterruption);
      window.removeEventListener('pointercancel', onWindowInterruption);
      cancelAllInteractions();
    };
  }, [cancelAllInteractions, clearProvisionalSlot, provisionalSlot, handleConfirmProvisional]);

  // ─── Gestor de Zoom Táctil (Pinch-to-Zoom) con Anclaje Focal ───────────────
  const pinchRef = useRef<{
    active: boolean;
    initialDist: number;
    initialHourHeight: number;
    midYInGrid: number;
    midYInContainer: number;
  }>({
    active: false,
    initialDist: 0,
    initialHourHeight: DEFAULT_HOUR_HEIGHT,
    midYInGrid: 0,
    midYInContainer: 0,
  });

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        // Al iniciar pellizco con 2 dedos, cancelar selecciones/movimientos incompletos
        cancelDrag();
        cancelMove();
        cancelResize();

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const initialDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const containerRect = container.getBoundingClientRect();
        const midYClient = (t1.clientY + t2.clientY) / 2;
        const midYInContainer = midYClient - containerRect.top;
        const midYInGrid = container.scrollTop + midYInContainer;

        pinchRef.current = {
          active: true,
          initialDist,
          initialHourHeight: hourHeight,
          midYInGrid,
          midYInContainer,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2 && pinchRef.current.active) {
        // Prevenir el zoom completo del navegador a nivel de viewport
        if (e.cancelable) e.preventDefault();

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (pinchRef.current.initialDist <= 0) return;

        const scale = currentDist / pinchRef.current.initialDist;
        const targetHeight = Math.min(
          MAX_HOUR_HEIGHT,
          Math.max(MIN_HOUR_HEIGHT, Math.round(pinchRef.current.initialHourHeight * scale))
        );

        if (targetHeight !== hourHeight) {
          requestAnimationFrame(() => {
            const ratio = targetHeight / pinchRef.current.initialHourHeight;
            const newMidYInGrid = pinchRef.current.midYInGrid * ratio;
            const newScrollTop = Math.max(0, newMidYInGrid - pinchRef.current.midYInContainer);

            updateHourHeight(targetHeight);
            if (container) {
              container.scrollTop = newScrollTop;
            }
          });
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2 && pinchRef.current.active) {
        pinchRef.current.active = false;
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [hourHeight, updateHourHeight, cancelDrag, cancelMove, cancelResize]);

  // Desseleccionar cita al hacer click fuera del calendario
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.booking-card') &&
        !target.closest('.resize-handle') &&
        !target.closest('.provisional-card')
      ) {
        setSelectedCitaId(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // ─── Autoscroll durante arrastre ──────────────────────────────────────────────
  const handleAutoScrollAndPosition = useCallback((clientY: number, onTick?: () => void) => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const EDGE_THRESHOLD = 45;

    let scrollSpeed = 0;
    if (clientY - containerRect.top < EDGE_THRESHOLD) {
      const diff = EDGE_THRESHOLD - (clientY - containerRect.top);
      scrollSpeed = -Math.max(4, Math.floor(diff / 2.5));
    } else if (containerRect.bottom - clientY < EDGE_THRESHOLD) {
      const diff = EDGE_THRESHOLD - (containerRect.bottom - clientY);
      scrollSpeed = Math.max(4, Math.floor(diff / 2.5));
    }

    if (scrollSpeed !== 0) {
      const stepScroll = () => {
        if (!scrollContainerRef.current) { stopAutoScroll(); return; }
        const isAnyDragActive =
          provisionalDragRef.current.active ||
          moveRef.current.active ||
          resizeRef.current.active;
        if (!isAnyDragActive) { stopAutoScroll(); return; }
        scrollContainerRef.current.scrollTop += scrollSpeed;
        onTick?.();
        autoScrollRafRef.current = requestAnimationFrame(stepScroll);
      };
      if (autoScrollRafRef.current === null) {
        autoScrollRafRef.current = requestAnimationFrame(stepScroll);
      }
    } else {
      stopAutoScroll();
      onTick?.();
    }
  }, [stopAutoScroll]);

  // ─── Handlers de Pointer Events (CREACIÓN y SELECCIÓN PROVISIONAL) ─────────────

  const handlePointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    dayStr: string,
    empleadoId: string,
  ) => {
    // Validar estado de la máquina de interacción
    if (!isStateIdleOr('selecting')) return;
    if ((e.target as HTMLElement).closest('.booking-card')) return;
    if ((e.target as HTMLElement).closest('.provisional-card')) return;

    if (moveRef.current.active || moveRef.current.pending || resizeRef.current.active) return;

    cancelDrag();
    interactionStateRef.current = 'selecting';

    const colEl = e.currentTarget;
    const rect = colEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const startMin = yToMinutes(y, 15, hourHeight);

    provisionalDragRef.current = {
      active: false,
      mode: 'create',
      dayStr,
      empleadoId,
      originalDayStr: dayStr,
      originalEmpleadoId: empleadoId,
      originalStartMin: startMin,
      originalEndMin: Math.min((HORA_FIN + 1) * 60, startMin + 30),
      startMinutes: startMin,
      grabOffsetY: 0,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      pointerType: e.pointerType,
      targetCol: colEl,
      pending: true,
      wasDragged: false,
    };

    if (e.pointerType === 'mouse') {
      mousePendingRef.current = true;
      try { colEl.setPointerCapture(e.pointerId); } catch {}
    } else {
      // Touch o Pen: Iniciar temporizador de long press
      longPressPendingRef.current = true;
      longPressTimerRef.current = setTimeout(() => {
        if (!longPressPendingRef.current) return;
        longPressPendingRef.current = false;
        provisionalDragRef.current.active = true;

        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([15, 30]); } catch {}
        }

        try { colEl.setPointerCapture(e.pointerId); } catch {}

        const endMin = Math.min((HORA_FIN + 1) * 60, startMin + 30);
        const isOverlap = checkOverlap(citasPorDia[dayStr] || [], empleadoId, startMin, endMin);
        setProvisionalSlot({
          dayStr,
          empleadoId,
          startMin,
          endMin,
          isOverlap,
        });
      }, TOUCH_LONG_PRESS_MS);
    }

    setHoveredSlot(null);
  }, [cancelDrag, citasPorDia]);

  const handlePointerMove = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    dayStr: string,
    empleadoId: string,
  ) => {
    const pDrag = provisionalDragRef.current;

    // ── Hover guide (cuando no hay drag activo ni slot provisional) ──
    if (
      !pDrag.active &&
      !longPressPendingRef.current &&
      !mousePendingRef.current &&
      !moveRef.current.active &&
      !resizeRef.current.active
    ) {
      if (
        (e.target as HTMLElement).closest('.booking-card') ||
        (e.target as HTMLElement).closest('.provisional-card')
      ) {
        setHoveredSlot(null);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const slotMin = yToMinutes(y, 15, hourHeight);
      const topPx = minutesToY(slotMin, hourHeight);
      setHoveredSlot({
        dayStr,
        empleadoId,
        top: topPx,
        timeLabel: formatTime12h(minutesToTimeStr(slotMin)),
      });
      return;
    }

    if (pDrag.mode !== 'create') return;
    if (pDrag.dayStr !== dayStr || pDrag.empleadoId !== empleadoId) return;

    const dist = Math.hypot(e.clientX - pDrag.startX, e.clientY - pDrag.startY);

    if (longPressPendingRef.current) {
      if (dist > TOUCH_MOVE_THRESHOLD) {
        interactionStateRef.current = 'scrolling';
        cancelDrag();
      }
      return;
    }

    if (mousePendingRef.current) {
      if (dist > MOUSE_MOVE_THRESHOLD) {
        mousePendingRef.current = false;
        provisionalDragRef.current.active = true;
        provisionalDragRef.current.wasDragged = true;
      } else {
        return;
      }
    }

    if (pDrag.active) {
      e.preventDefault();
      const colRect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - colRect.top;
      const currentMin = yToMinutes(Math.max(0, Math.min(y, colRect.height)), 15, hourHeight);

      const minStart = Math.min(pDrag.startMinutes, currentMin);
      let minEnd = Math.max(pDrag.startMinutes, currentMin);
      if (minEnd - minStart < 15) minEnd = minStart + 15;

      provisionalDragRef.current.wasDragged = true;

      const isOverlap = checkOverlap(citasPorDia[dayStr] || [], empleadoId, minStart, minEnd);
      setProvisionalSlot({
        dayStr,
        empleadoId,
        startMin: minStart,
        endMin: minEnd,
        isOverlap,
      });

      handleAutoScrollAndPosition(e.clientY);
    }
  }, [cancelDrag, citasPorDia, handleAutoScrollAndPosition]);

  const handlePointerUp = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    dayStr: string,
    empleadoId: string,
  ) => {
    const pDrag = provisionalDragRef.current;
    if (pDrag.mode !== 'create') return;

    const isPendingTouchTap = longPressPendingRef.current;
    const isPendingMouseClick = mousePendingRef.current;
    const wasActive = pDrag.active;
    const wasDragged = pDrag.wasDragged;
    const startMin = pDrag.startMinutes;

    cancelDrag();

    if (pDrag.dayStr !== dayStr || pDrag.empleadoId !== empleadoId) return;

    // Caso A: Clic simple o Tap rápido en espacio vacío -> slot por defecto de 30 min
    if (isPendingTouchTap || isPendingMouseClick || (!wasDragged && !wasActive)) {
      const endMin = Math.min((HORA_FIN + 1) * 60, startMin + 30);
      const isOverlap = checkOverlap(citasPorDia[dayStr] || [], empleadoId, startMin, endMin);

      setProvisionalSlot({
        dayStr,
        empleadoId,
        startMin,
        endMin,
        isOverlap,
      });
      return;
    }

    // Caso B: Arrastre completado -> fijar el rango en el bloque provisional local (NO abre formulario)
    if (wasActive || wasDragged) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const endMinRaw = yToMinutes(Math.max(0, Math.min(y, rect.height)), 15, hourHeight);

      const minStart = Math.min(startMin, endMinRaw);
      let minEnd = Math.max(startMin, endMinRaw);
      if (minEnd - minStart < 15) minEnd = minStart + 15;

      const isOverlap = checkOverlap(citasPorDia[dayStr] || [], empleadoId, minStart, minEnd);
      setProvisionalSlot({
        dayStr,
        empleadoId,
        startMin: minStart,
        endMin: minEnd,
        isOverlap,
      });
    }
  }, [cancelDrag, citasPorDia]);

  const handlePointerCancel = useCallback(() => {
    cancelDrag();
  }, [cancelDrag]);

  // ─── Handlers de MOVIMIENTO de cita existente ─────────────────────────────────

  /** Encuentra qué columna (día + empleado) corresponde a un punto (clientX, clientY) */
  const findColumnAt = useCallback((clientX: number, clientY: number): { dayStr: string; empleadoId: string; colEl: HTMLElement } | null => {
    // Usamos elementsFromPoint para encontrar la columna bajo el cursor
    const elements = document.elementsFromPoint(clientX, clientY);
    for (const el of elements) {
      const col = (el as HTMLElement).closest('[data-drag-col]');
      if (col) {
        const colEl = col as HTMLElement;
        const dayStr = colEl.dataset.dayStr || '';
        const empleadoId = colEl.dataset.empleadoId || '';
        if (dayStr && empleadoId) {
          return { dayStr, empleadoId, colEl };
        }
      }
    }
    return null;
  }, []);

  // ─── Handlers de MOVIMIENTO y RESIZE del bloque PROVISIONAL (FASE 2) ─────────────

  const handleProvisionalBodyPointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    if (!provisionalSlot) return;
    if (!isStateIdleOr('moving-selection')) return;

    e.stopPropagation();
    interactionStateRef.current = 'moving-selection';

    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const grabOffsetY = e.clientY - rect.top;

    provisionalDragRef.current = {
      active: false,
      mode: 'move',
      dayStr: provisionalSlot.dayStr,
      empleadoId: provisionalSlot.empleadoId,
      originalDayStr: provisionalSlot.dayStr,
      originalEmpleadoId: provisionalSlot.empleadoId,
      originalStartMin: provisionalSlot.startMin,
      originalEndMin: provisionalSlot.endMin,
      startMinutes: provisionalSlot.startMin,
      grabOffsetY,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      pointerType: e.pointerType,
      targetCol: card,
      pending: true,
      wasDragged: false,
    };

    try { card.setPointerCapture(e.pointerId); } catch {}
  }, [provisionalSlot]);

  const handleProvisionalBodyPointerMove = useCallback((
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const pDrag = provisionalDragRef.current;
    if (pDrag.mode !== 'move') return;

    const distX = Math.abs(e.clientX - pDrag.startX);
    const distY = Math.abs(e.clientY - pDrag.startY);
    const dist = Math.hypot(distX, distY);

    if (dist > 5) {
      pDrag.active = true;
      pDrag.wasDragged = true;
      pDrag.pending = false;
    }

    if (!pDrag.active) return;

    e.preventDefault();
    e.stopPropagation();

    let targetDayStr = pDrag.originalDayStr;
    let targetEmpleadoId = pDrag.originalEmpleadoId;
    let colEl: HTMLElement | null = null;

    // Solo evaluar cambio de columna/empleado si la distancia horizontal supera los 40px (acción explícita)
    if (distX > 40) {
      const colInfo = findColumnAt(e.clientX, e.clientY);
      if (colInfo) {
        if (colInfo.empleadoId !== pDrag.originalEmpleadoId) {
          if (canMoveToOtherEmployee(null)) {
            targetEmpleadoId = colInfo.empleadoId;
          }
        } else {
          targetEmpleadoId = colInfo.empleadoId;
        }
        targetDayStr = colInfo.dayStr || pDrag.originalDayStr;
        colEl = colInfo.colEl;
      }
    }

    let colRect: DOMRect | null = null;
    if (colEl) {
      colRect = colEl.getBoundingClientRect();
    } else if (pDrag.targetCol) {
      const parentCol = pDrag.targetCol.closest('[data-drag-col]') as HTMLElement | null;
      colRect = parentCol?.getBoundingClientRect() ?? null;
    }

    if (colRect) {
      const y = e.clientY - colRect.top - pDrag.grabOffsetY;
      const dur = pDrag.originalEndMin - pDrag.originalStartMin;
      // Ajuste estricto a incrementos de 15 minutos
      const newStartMin = yToMinutes(Math.max(0, y), 15, hourHeight);
      const clampedStart = Math.min(Math.max(HORA_INICIO * 60, newStartMin), (HORA_FIN + 1) * 60 - dur);
      const newEndMin = clampedStart + dur;

      const isOverlap = checkOverlap(citasPorDia[targetDayStr] || [], targetEmpleadoId, clampedStart, newEndMin);

      setProvisionalSlot({
        dayStr: targetDayStr,
        empleadoId: targetEmpleadoId,
        startMin: clampedStart,
        endMin: newEndMin,
        isOverlap,
      });
    }

    handleAutoScrollAndPosition(e.clientY);
  }, [findColumnAt, canMoveToOtherEmployee, citasPorDia, handleAutoScrollAndPosition, hourHeight]);

  const handleProvisionalBodyPointerUp = useCallback((
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const pDrag = provisionalDragRef.current;
    if (pDrag.mode !== 'move') return;

    stopAutoScroll();
    if (pDrag.targetCol && pDrag.pointerId >= 0) {
      try { pDrag.targetCol.releasePointerCapture(pDrag.pointerId); } catch {}
    }

    const wasDragged = pDrag.wasDragged;
    pDrag.active = false;
    pDrag.pending = false;

    // Si fue un toque o clic único sin arrastrar -> abrir el formulario (CONFIRMACIÓN)
    if (!wasDragged) {
      handleConfirmProvisional();
    }
  }, [stopAutoScroll, handleConfirmProvisional]);

  const handleProvisionalResizePointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    handle: 'top' | 'bottom'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (!provisionalSlot) return;
    const nextState = handle === 'top' ? 'resizing-start' : 'resizing-end';
    if (!isStateIdleOr(nextState)) return;

    interactionStateRef.current = nextState;

    const handleEl = e.currentTarget;
    provisionalDragRef.current = {
      active: true,
      mode: handle === 'top' ? 'resize-top' : 'resize-bottom',
      dayStr: provisionalSlot.dayStr,
      empleadoId: provisionalSlot.empleadoId,
      originalDayStr: provisionalSlot.dayStr,
      originalEmpleadoId: provisionalSlot.empleadoId,
      originalStartMin: provisionalSlot.startMin,
      originalEndMin: provisionalSlot.endMin,
      startMinutes: provisionalSlot.startMin,
      grabOffsetY: 0,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      pointerType: e.pointerType,
      targetCol: handleEl,
      pending: false,
      wasDragged: false,
    };

    try { handleEl.setPointerCapture(e.pointerId); } catch {}
  }, [provisionalSlot]);

  const handleProvisionalResizePointerMove = useCallback((
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const pDrag = provisionalDragRef.current;
    if (pDrag.mode !== 'resize-top' && pDrag.mode !== 'resize-bottom') return;
    if (!provisionalSlot) return;

    e.preventDefault();
    e.stopPropagation();

    const colEl = pDrag.targetCol?.closest('[data-drag-col]') as HTMLElement | null;
    if (!colEl) return;

    const colRect = colEl.getBoundingClientRect();
    const y = e.clientY - colRect.top;
    const snapMin = yToMinutes(Math.max(0, y), 15, hourHeight);

    let newStartMin = provisionalSlot.startMin;
    let newEndMin = provisionalSlot.endMin;

    if (pDrag.mode === 'resize-top') {
      newStartMin = Math.min(snapMin, provisionalSlot.endMin - 15);
      newStartMin = Math.max(HORA_INICIO * 60, newStartMin);
    } else {
      newEndMin = Math.max(snapMin, provisionalSlot.startMin + 15);
      newEndMin = Math.min((HORA_FIN + 1) * 60, newEndMin);
    }

    pDrag.wasDragged = true;
    const isOverlap = checkOverlap(citasPorDia[provisionalSlot.dayStr] || [], provisionalSlot.empleadoId, newStartMin, newEndMin);

    setProvisionalSlot({
      ...provisionalSlot,
      startMin: newStartMin,
      endMin: newEndMin,
      isOverlap,
    });

    handleAutoScrollAndPosition(e.clientY);
  }, [provisionalSlot, citasPorDia, handleAutoScrollAndPosition]);

  const handleProvisionalResizePointerUp = useCallback((
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const pDrag = provisionalDragRef.current;
    if (pDrag.mode !== 'resize-top' && pDrag.mode !== 'resize-bottom') return;

    stopAutoScroll();
    if (pDrag.targetCol && pDrag.pointerId >= 0) {
      try { pDrag.targetCol.releasePointerCapture(pDrag.pointerId); } catch {}
    }
    pDrag.active = false;
  }, [stopAutoScroll]);

  const handleMouseLeave = useCallback((dayStr: string, empleadoId: string) => {
    if (!provisionalDragRef.current.active && !longPressPendingRef.current && !mousePendingRef.current) {
      setHoveredSlot(null);
    }
  }, []);

  /** pointerdown en una booking-card — inicia posible movimiento */

  /** pointerdown en una booking-card — inicia posible movimiento */
  const handleCitaPointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    cita: any,
    citaDayStr: string,
    citaEmpleadoId: string,
  ) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    if (!isStateIdleOr('moving-appointment')) return;

    e.stopPropagation();
    interactionStateRef.current = 'moving-appointment';

    // Guardar offset de agarre dentro de la cita
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const grabOffsetY = e.clientY - rect.top;

    const startMin = timeToMinutes(cita.hora);
    const isEditable = canMoveCita(cita);

    moveRef.current = {
      active: false,
      citaId: cita.id,
      cita,
      originalDayStr: citaDayStr,
      originalEmpleadoId: citaEmpleadoId,
      originalStartMin: startMin,
      currentDayStr: citaDayStr,
      currentEmpleadoId: citaEmpleadoId,
      currentStartMin: startMin,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      pointerType: e.pointerType,
      grabOffsetY,
      targetEl: card,
      pending: true,
    };

    if (isEditable) {
      if (e.pointerType === 'mouse') {
        citaMousePendingRef.current = true;
        try { card.setPointerCapture(e.pointerId); } catch {}
      } else {
        // Touch: long-press para activar movimiento
        citaLongPressTimerRef.current = setTimeout(() => {
          if (!moveRef.current.pending || moveRef.current.citaId !== cita.id) return;
          moveRef.current.active = true;
          moveRef.current.pending = false;

          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate([20, 40]); } catch {}
          }

          try { card.setPointerCapture(e.pointerId); } catch {}

          // Mostrar ghost inmediatamente
          const catColor = cita.servicio?.categoriaRel?.color || '#3b82f6';
          const duration = cita.duracion || 30;
          const topPx = minutesToY(startMin, hourHeight);
          const heightPx = Math.max(MIN_HEIGHT, duration * (hourHeight / 60));
          setMoveGhost({
            topPx, heightPx,
            dayStr: citaDayStr,
            empleadoId: citaEmpleadoId,
            startLabel: minutesToLabel(startMin),
            endLabel: minutesToLabel(startMin + duration),
            isOverlap: false,
            catColor,
          });
        }, CITA_MOVE_LONG_PRESS_MS);
      }
    }
  }, [canMoveCita]);

  /** pointermove en una booking-card */
  const handleCitaPointerMove = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    cita: any,
  ) => {
    const mv = moveRef.current;
    if (mv.citaId !== cita.id) return;
    if (!mv.pending && !mv.active) return;

    const distX = e.clientX - mv.startClientX;
    const distY = e.clientY - mv.startClientY;
    const dist = Math.hypot(distX, distY);

    // Touch pending: si el movimiento es muy grande antes del long-press, cancelar e ir a scrolling
    if (mv.pending && mv.pointerType !== 'mouse') {
      if (dist > TOUCH_MOVE_THRESHOLD) {
        interactionStateRef.current = 'scrolling';
        cancelMove();
      }
      return;
    }

    // Mouse pending: activar movimiento si supera el umbral
    if (citaMousePendingRef.current) {
      if (dist > CITA_MOVE_MOUSE_THRESHOLD) {
        citaMousePendingRef.current = false;
        moveRef.current.active = true;
        moveRef.current.pending = false;
      } else {
        return;
      }
    }

    if (!mv.active) return;

    e.preventDefault();
    e.stopPropagation();

    // Determinar columna bajo el cursor (para cambio de profesional/día)
    const colInfo = findColumnAt(e.clientX, e.clientY);
    let targetDayStr = mv.currentDayStr;
    let targetEmpleadoId = mv.currentEmpleadoId;
    let colEl: HTMLElement | null = null;

    if (colInfo) {
      // Verificar si puede cambiar de profesional
      if (colInfo.empleadoId !== mv.originalEmpleadoId) {
        if (canMoveToOtherEmployee(mv.cita)) {
          targetEmpleadoId = colInfo.empleadoId;
        }
        // Si no puede cambiar de profesional, solo permitir cambio vertical en la columna original
      } else {
        targetEmpleadoId = colInfo.empleadoId;
      }
      targetDayStr = colInfo.dayStr || mv.originalDayStr;
      colEl = colInfo.colEl;
    }

    // Calcular nueva hora según la posición vertical
    let colRect: DOMRect | null = null;
    if (colEl) {
      colRect = colEl.getBoundingClientRect();
    } else if (mv.targetEl) {
      // fallback: usar la tarjeta original para estimar
      const parentCol = mv.targetEl.closest('[data-drag-col]') as HTMLElement | null;
      colRect = parentCol?.getBoundingClientRect() ?? null;
    }

    if (colRect) {
      const y = e.clientY - colRect.top - mv.grabOffsetY;
      const newStartMin = yToMinutes(Math.max(0, y), 5, hourHeight);
      const duration = mv.cita.duracion || 30;
      const clampedStart = Math.min(Math.max(HORA_INICIO * 60, newStartMin), (HORA_FIN + 1) * 60 - duration);

      moveRef.current.currentStartMin = clampedStart;
      moveRef.current.currentDayStr = targetDayStr;
      moveRef.current.currentEmpleadoId = targetEmpleadoId;

      const topPx = minutesToY(clampedStart, hourHeight);
      const heightPx = Math.max(MIN_HEIGHT, duration * (hourHeight / 60));
      const catColor = mv.cita.servicio?.categoriaRel?.color || '#3b82f6';

      const citasDiaTarget = citasPorDia[targetDayStr] || [];
      const isOverlap = checkOverlap(citasDiaTarget, targetEmpleadoId, clampedStart, clampedStart + duration);

      setMoveGhost({
        topPx, heightPx,
        dayStr: targetDayStr,
        empleadoId: targetEmpleadoId,
        startLabel: minutesToLabel(clampedStart),
        endLabel: minutesToLabel(clampedStart + duration),
        isOverlap,
        catColor,
      });
    }

    handleAutoScrollAndPosition(e.clientY);
  }, [cancelMove, canMoveToOtherEmployee, findColumnAt, citasPorDia, handleAutoScrollAndPosition]);

  /** pointerup en una booking-card — finaliza movimiento o dispara click */
  const handleCitaPointerUp = useCallback(async (
    e: React.PointerEvent<HTMLDivElement>,
    cita: any,
  ) => {
    const mv = moveRef.current;
    if (mv.citaId !== cita.id) return;

    const wasPending = mv.pending || citaMousePendingRef.current;
    const wasActive = mv.active;

    cancelMove();
    stopAutoScroll();

    // Click simple → abrir detalles
    if (wasPending) {
      setSelectedCitaId(prev => prev === cita.id ? null : cita.id);
      (onViewCita || onEditCita)(cita);
      return;
    }

    if (!wasActive) return;

    // Aplicar movimiento
    const newStartMin = mv.currentStartMin;
    const newDayStr = mv.currentDayStr;
    const newEmpleadoId = mv.currentEmpleadoId;

    // Si no hubo cambio real, no hacer nada
    if (
      newStartMin === mv.originalStartMin &&
      newDayStr === mv.originalDayStr &&
      newEmpleadoId === mv.originalEmpleadoId
    ) {
      return;
    }

    if (!onMoveCita) return;

    const newHora = minutesToTimeStr(newStartMin);
    const clientUpdatedAt = cita.updated_at || new Date().toISOString();

    const previousSnapshot = {
      fecha: getCitaDateStr(cita),
      hora: cita.hora,
      duracion: cita.duracion,
      empleadoId: cita.empleado_id,
      clientUpdatedAt,
    };

    const result = await onMoveCita({
      citaId: cita.id,
      fecha: newDayStr,
      hora: newHora,
      empleadoId: newEmpleadoId,
      duracion: cita.duracion,
      clientUpdatedAt,
    });

    // Mostrar snackbar de deshacer solo si fue exitoso (result sin error)
    if (!result || !result.error) {
      const empNombre = empleados.find(emp => emp.id === newEmpleadoId)?.nombre?.split(' ')[0] || '';
      showSnackbar(
        `Cita movida a ${formatTime12h(newHora)}${empNombre ? ` · ${empNombre}` : ''}`,
        cita.id,
        previousSnapshot,
      );
    }
  }, [cancelMove, stopAutoScroll, onViewCita, onEditCita, onMoveCita, getCitaDateStr, empleados, showSnackbar]);

  // ─── Handlers de RESIZE ───────────────────────────────────────────────────────

  const handleResizePointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    cita: any,
    handle: 'top' | 'bottom',
    citaDayStr: string,
    citaEmpleadoId: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (!canMoveCita(cita)) return;
    const nextState = handle === 'top' ? 'resizing-start' : 'resizing-end';
    if (!isStateIdleOr(nextState)) return;

    interactionStateRef.current = nextState;

    const handleEl = e.currentTarget;
    const startMin = timeToMinutes(cita.hora);
    const endMin = startMin + (cita.duracion || 30);

    resizeRef.current = {
      active: true,
      citaId: cita.id,
      cita,
      handle,
      originalStartMin: startMin,
      originalEndMin: endMin,
      currentStartMin: startMin,
      currentEndMin: endMin,
      dayStr: citaDayStr,
      empleadoId: citaEmpleadoId,
      pointerId: e.pointerId,
      targetEl: handleEl,
    };

    try { handleEl.setPointerCapture(e.pointerId); } catch {}
  }, [canMoveCita]);

  const handleResizePointerMove = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    cita: any,
  ) => {
    const rs = resizeRef.current;
    if (!rs.active || rs.citaId !== cita.id) return;

    e.preventDefault();
    e.stopPropagation();

    // Encontrar columna para obtener coordenadas
    const colEl = (resizeRef.current.targetEl?.closest('[data-drag-col]')) as HTMLElement | null;
    if (!colEl) return;

    const colRect = colEl.getBoundingClientRect();
    const y = e.clientY - colRect.top;
    const snapMin = yToMinutes(Math.max(0, y), 5, hourHeight);

    let newStartMin = rs.currentStartMin;
    let newEndMin = rs.currentEndMin;

    if (rs.handle === 'top') {
      // Redimensionar desde arriba: cambiar hora inicio, mantener fin
      newStartMin = Math.min(snapMin, rs.currentEndMin - MIN_APPOINTMENT_MINUTES);
      newStartMin = Math.max(HORA_INICIO * 60, newStartMin);
    } else {
      // Redimensionar desde abajo: cambiar hora fin, mantener inicio
      newEndMin = Math.max(snapMin, rs.currentStartMin + MIN_APPOINTMENT_MINUTES);
      newEndMin = Math.min((HORA_FIN + 1) * 60, newEndMin);
    }

    resizeRef.current.currentStartMin = newStartMin;
    resizeRef.current.currentEndMin = newEndMin;

    const topPx = minutesToY(newStartMin, hourHeight);
    const heightPx = Math.max(MIN_HEIGHT, (newEndMin - newStartMin) * (hourHeight / 60));

    setResizeGhost({
      topPx, heightPx,
      dayStr: rs.dayStr,
      empleadoId: rs.empleadoId,
      startLabel: minutesToLabel(newStartMin),
      endLabel: minutesToLabel(newEndMin),
      durationMin: newEndMin - newStartMin,
    });

    handleAutoScrollAndPosition(e.clientY);
  }, [handleAutoScrollAndPosition]);

  const handleResizePointerUp = useCallback(async (
    e: React.PointerEvent<HTMLDivElement>,
    cita: any,
  ) => {
    const rs = resizeRef.current;
    if (!rs.active || rs.citaId !== cita.id) return;

    const newStartMin = rs.currentStartMin;
    const newEndMin = rs.currentEndMin;

    cancelResize();
    stopAutoScroll();

    // Si no hubo cambio real, no hacer nada
    if (newStartMin === rs.originalStartMin && newEndMin === rs.originalEndMin) return;

    if (!onMoveCita) return;

    const newHora = minutesToTimeStr(newStartMin);
    const newDuracion = newEndMin - newStartMin;
    const clientUpdatedAt = cita.updated_at || new Date().toISOString();

    const previousSnapshot = {
      fecha: getCitaDateStr(cita),
      hora: cita.hora,
      duracion: cita.duracion,
      empleadoId: cita.empleado_id,
      clientUpdatedAt,
    };

    const result = await onMoveCita({
      citaId: cita.id,
      fecha: rs.dayStr,
      hora: newHora,
      empleadoId: rs.empleadoId,
      duracion: newDuracion,
      clientUpdatedAt,
    });

    if (!result || !result.error) {
      showSnackbar(
        `Cita ajustada: ${formatTime12h(newHora)} · ${newDuracion} min`,
        cita.id,
        previousSnapshot,
      );
    }
  }, [cancelResize, stopAutoScroll, onMoveCita, getCitaDateStr, showSnackbar]);

  // ─── Acción de Deshacer ───────────────────────────────────────────────────────
  const handleUndo = useCallback(async () => {
    const snap = snackbar.previousSnapshot;
    const citaId = snackbar.citaId;
    if (!citaId || !onMoveCita) return;

    dismissSnackbar();

    await onMoveCita({
      citaId,
      fecha: snap.fecha,
      hora: snap.hora,
      empleadoId: snap.empleadoId,
      duracion: snap.duracion,
      clientUpdatedAt: snap.clientUpdatedAt,
    });
  }, [snackbar, onMoveCita, dismissSnackbar]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100dvh-130px)] sm:h-[750px] min-h-[520px] sm:max-h-[85vh] border border-border/50 rounded-2xl bg-card overflow-hidden shadow-lg select-none relative pb-safe">
      
      {/* CABECERA DEL CALENDARIO */}
      <div className="flex flex-col gap-1.5 p-2 sm:p-4 border-b border-border/50 bg-secondary/15 z-30 shrink-0 sticky top-0 backdrop-blur-md">
        <div className="flex items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
          {/* Controles de Navegación de Fecha y Control Discreto de Zoom */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-between sm:justify-start">
            <Button variant="outline" size="sm" onClick={irAHoy} className="font-bold gap-1 text-xs hover-lift cursor-pointer h-9 px-3 shrink-0">
              <CalendarIcon className="w-3.5 h-3.5" /> Hoy
            </Button>
            <div className="flex items-center border border-border rounded-lg bg-background shadow-xs h-9">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none cursor-pointer" onClick={() => cambiarFecha(-1)} aria-label="Fecha anterior">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs sm:text-sm font-extrabold px-2 sm:px-3 border-x border-border py-1 text-foreground min-w-[95px] sm:min-w-[130px] text-center truncate">
                {tituloCabecera}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none cursor-pointer" onClick={() => cambiarFecha(1)} aria-label="Fecha siguiente">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Control Discreto de Zoom Vertical (- 100% +) */}
            <div className="flex items-center border border-border rounded-lg bg-background shadow-xs h-9 p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-7 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => updateHourHeight(hourHeight - 15)}
                disabled={hourHeight <= MIN_HOUR_HEIGHT}
                title="Reducir escala vertical (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <button
                type="button"
                onClick={() => updateHourHeight(DEFAULT_HOUR_HEIGHT)}
                className="text-xs font-black px-1.5 min-w-[44px] text-center text-foreground hover:text-primary transition-colors cursor-pointer select-none"
                title="Restablecer escala al 100%"
              >
                {Math.round((hourHeight / DEFAULT_HOUR_HEIGHT) * 100)}%
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-7 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => updateHourHeight(hourHeight + 15)}
                disabled={hourHeight >= MAX_HOUR_HEIGHT}
                title="Aumentar escala vertical (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>

            {scope === 'all' && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                <Users className="w-3 h-3 shrink-0" /> Global
              </span>
            )}
          </div>

          {/* Toggles de Vista */}
          <div className="flex bg-secondary/40 p-0.5 rounded-xl border border-border/50 shadow-inner h-9 items-center ml-auto sm:ml-0">
            {[
              { id: 'dia', label: 'Día' },
              { id: '3dias', label: '3 Días' },
              { id: 'semana', label: 'Semana' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setVista(tab.id as any)}
                className={cn(
                  "px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer h-7 flex items-center justify-center min-w-[42px]",
                  vista === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* SELECTOR MÓVIL DE PROFESIONAL (Pestañas horizontales amplias) */}
        {empleadosBase.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-border/20 touch-pan-x">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">Estilista:</span>
            <button
              onClick={() => setActiveMobileEmpId('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-extrabold rounded-full transition-all shrink-0 cursor-pointer h-8 flex items-center gap-1.5 border min-h-[34px]",
                activeMobileEmpId === 'all'
                  ? "bg-primary/15 text-primary border-primary/50 font-black shadow-xs"
                  : "bg-background/80 text-muted-foreground border-border/60 hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <Users className="w-3.5 h-3.5" /> Todos ({empleadosBase.length})
            </button>
            {empleadosBase.map((emp) => {
              const isActive = activeMobileEmpId === emp.id;
              return (
                <button
                  key={emp.id}
                  onClick={() => setActiveMobileEmpId(emp.id)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-extrabold rounded-full transition-all shrink-0 cursor-pointer h-8 flex items-center gap-1.5 border min-h-[34px]",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary font-black shadow-xs"
                      : "bg-background/80 text-muted-foreground border-border/60 hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  <User className="w-3.5 h-3.5" /> {emp.nombre.split(' ')[0]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CONTENEDOR DE GRID Y HORAS (SCROLL) */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto relative custom-scrollbar bg-background/5">
        
        {/* Envoltorio con Ancho Mínimo */}
        <div
          className="flex flex-col h-full min-h-[850px]"
          style={{ minWidth: minGridWidth }}
        >
          {/* CABECERA DE DÍAS Y EMPLEADOS (Sticky top) */}
          <div className="flex sticky top-0 bg-card border-b border-border/40 z-30 shadow-xs">
            {/* Esquina superior izquierda */}
            <div className="w-14 sm:w-20 shrink-0 sticky left-0 bg-card border-r border-border/40 z-40 flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider" />
            
            {/* Columnas de nombres de días y empleados */}
            <div className="flex-1 flex">
              {diasAMostrar.map((dia, dIdx) => {
                const todayCR = getBusinessTodayString();
                const esHoy = formatLocalDate(dia) === todayCR;
                return (
                  <div
                    key={dIdx}
                    className={cn(
                      "flex-1 flex flex-col border-r border-border/20 last:border-r-0",
                      esHoy && "bg-primary/[0.02] text-primary"
                    )}
                  >
                    {/* Header del Día */}
                    <div className="py-1.5 sm:py-2 text-center border-b border-border/20 bg-secondary/10 flex flex-col items-center justify-center min-w-[85px]">
                      <span className="text-[10px] sm:text-[9px] uppercase font-extrabold text-muted-foreground tracking-wider">
                        {DIAS_SEMANA_ABR[dia.getDay()]}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-black w-6 h-6 flex items-center justify-center rounded-full mt-0.5 transition-all",
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
                          className="flex-1 py-1.5 text-center text-xs sm:text-[10px] font-extrabold text-foreground/80 truncate px-1"
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
          <div className="flex relative flex-1" style={{ height: `${TOTAL_HORAS * hourHeight}px` }}>
            
            {/* Columna lateral de Horas (sticky left) */}
            <div className="w-14 sm:w-20 shrink-0 sticky left-0 border-r border-border/40 bg-card z-20 select-none shadow-xs">
              {horasRegla.map((hora, idx) => (
                <div
                  key={idx}
                  className="relative text-right pr-1 sm:pr-2 text-xs sm:text-[10px] font-bold text-muted-foreground"
                  style={{ height: `${hourHeight}px` }}
                >
                  <span className="absolute -top-3 right-1 sm:right-2 bg-background px-1 rounded shadow-xs border border-border/20 text-[10px] sm:text-[11px] font-extrabold text-foreground">
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
                    style={{ height: `${hourHeight}px` }}
                  />
                ))}
              </div>

              {/* Líneas de cuartos de hora */}
              <div className="absolute inset-0 pointer-events-none select-none z-0">
                {Array.from({ length: TOTAL_HORAS * 4 }).map((_, idx) => {
                  if (idx % 4 === 0) return null;
                  return (
                    <div
                      key={idx}
                      className="border-b border-border/[0.08] w-full"
                      style={{ height: `${hourHeight / 4}px` }}
                    />
                  );
                })}
              </div>

              {/* Renderizado de Columnas por Día y Empleado */}
              {diasAMostrar.map((dia, dIdx) => {
                const diaStr = formatLocalDate(dia);
                const citasDiaTodos = citasPorDia[diaStr] || [];
                const esHoy = diaStr === getBusinessTodayString();

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

                      const isProvisionalHere = provisionalSlot?.dayStr === diaStr && provisionalSlot?.empleadoId === emp.id;
                      const isHoverHere = hoveredSlot?.dayStr === diaStr && hoveredSlot?.empleadoId === emp.id;
                      const isDraggingHere = provisionalDragRef.current.active && provisionalDragRef.current.dayStr === diaStr && provisionalDragRef.current.empleadoId === emp.id;
                      const isMoveGhostHere = moveGhost?.dayStr === diaStr && moveGhost?.empleadoId === emp.id;
                      const isResizeGhostHere = resizeGhost?.dayStr === diaStr && resizeGhost?.empleadoId === emp.id;

                      return (
                        <div
                          key={emp.id}
                          data-drag-col={`${diaStr}-${emp.id}`}
                          data-day-str={diaStr}
                          data-empleado-id={emp.id}
                          className={cn(
                            "flex-1 relative h-full min-w-[80px] transition-colors duration-150",
                            isDraggingHere
                              ? "bg-primary/[0.04] cursor-ns-resize"
                              : "cursor-pointer hover:bg-primary/[0.02]",
                            isMoveGhostHere && "bg-primary/[0.03]",
                          )}
                          style={{
                            touchAction: (isDraggingHere || provisionalDragRef.current.active || moveRef.current.active || resizeRef.current.active) ? 'none' : 'auto',
                          }}
                          onPointerDown={(e) => handlePointerDown(e, diaStr, emp.id)}
                          onPointerMove={(e) => handlePointerMove(e, diaStr, emp.id)}
                          onPointerUp={(e) => handlePointerUp(e, diaStr, emp.id)}
                          onPointerCancel={handlePointerCancel}
                          onMouseLeave={() => handleMouseLeave(diaStr, emp.id)}
                        >
                          {/* ── ÚNICO Bloque PROVISIONAL de creación / ajuste ── */}
                          {isProvisionalHere && provisionalSlot && (
                            <div
                              data-provisional-card
                              tabIndex={0}
                              className={cn(
                                "provisional-card absolute left-1 right-1 z-30 overflow-visible rounded-xl border-2 border-dashed shadow-xl transition-all duration-75 select-none focus:outline-none focus:ring-2 focus:ring-primary cursor-grab active:cursor-grabbing",
                                provisionalSlot.isOverlap
                                  ? "border-amber-500 bg-amber-500/20 text-amber-700 dark:text-amber-300 shadow-amber-500/10"
                                  : "border-primary/80 bg-primary/20 backdrop-blur-[2px] shadow-primary/20 text-primary"
                              )}
                              style={{
                                top: `${minutesToY(provisionalSlot.startMin, hourHeight)}px`,
                                height: `${Math.max(15, minutesToY(provisionalSlot.endMin, hourHeight) - minutesToY(provisionalSlot.startMin, hourHeight))}px`,
                                touchAction: 'none',
                              }}
                              onPointerDown={handleProvisionalBodyPointerDown}
                              onPointerMove={handleProvisionalBodyPointerMove}
                              onPointerUp={handleProvisionalBodyPointerUp}
                            >
                              {/* Handle de resize SUPERIOR (Modificar Hora Inicio) */}
                              <div
                                className="resize-handle absolute left-0 right-0 -top-3 h-6 flex items-center justify-center cursor-n-resize z-40 group/rh select-none touch-none"
                                title="Arrastrar para ajustar la hora de inicio"
                                onPointerDown={(e) => handleProvisionalResizePointerDown(e, 'top')}
                                onPointerMove={handleProvisionalResizePointerMove}
                                onPointerUp={handleProvisionalResizePointerUp}
                              >
                                <div className="w-10 h-1.5 rounded-full bg-primary shadow-xs group-hover/rh:scale-110 transition-transform pointer-events-none" />
                              </div>

                              {/* Borde lateral indicador */}
                              <div className={cn(
                                "absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl",
                                provisionalSlot.isOverlap ? "bg-amber-500" : "bg-primary"
                              )} />

                              {/* Contenido del bloque provisional (solo info) */}
                              <div className="relative z-10 flex flex-col h-full p-1 pl-2.5 pointer-events-none overflow-hidden">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 shrink-0 opacity-80" />
                                  <span className="text-[11px] font-black leading-tight truncate">
                                    {minutesToLabel(provisionalSlot.startMin)} – {minutesToLabel(provisionalSlot.endMin)}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold opacity-75 mt-0.5">
                                  {provisionalSlot.endMin - provisionalSlot.startMin} min
                                </span>
                                {provisionalSlot.isOverlap && (
                                  <div className="flex items-center gap-1 mt-0.5 px-1 py-0.5 rounded bg-amber-500/30 text-amber-900 dark:text-amber-200 font-extrabold text-[9px] border border-amber-500/40 w-fit">
                                    <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> Solapamiento
                                  </div>
                                )}
                              </div>

                              {/* Handle de resize INFERIOR (Modificar Hora Fin) */}
                              <div
                                className="resize-handle absolute left-0 right-0 -bottom-3 h-6 flex items-center justify-center cursor-s-resize z-40 group/rb select-none touch-none"
                                title="Arrastrar para ajustar la hora de fin"
                                onPointerDown={(e) => handleProvisionalResizePointerDown(e, 'bottom')}
                                onPointerMove={handleProvisionalResizePointerMove}
                                onPointerUp={handleProvisionalResizePointerUp}
                              >
                                <div className="w-10 h-1.5 rounded-full bg-primary shadow-xs group-hover/rb:scale-110 transition-transform pointer-events-none" />
                              </div>
                            </div>
                          )}

                          {/* ── Ghost Block de MOVIMIENTO de cita existente ── */}
                          {isMoveGhostHere && moveGhost && (
                            <div
                              className="absolute left-1 right-1 z-20 pointer-events-none overflow-hidden animate-in fade-in duration-75"
                              style={{
                                top: `${moveGhost.topPx}px`,
                                height: `${moveGhost.heightPx}px`,
                              }}
                            >
                              <div
                                className={cn(
                                  "absolute inset-0 rounded-xl border-2 border-dashed backdrop-blur-[3px] shadow-xl transition-colors",
                                  moveGhost.isOverlap
                                    ? "border-amber-500/80 bg-amber-500/15"
                                    : "border-primary/60 bg-primary/10"
                                )}
                                style={{ borderColor: moveGhost.isOverlap ? undefined : moveGhost.catColor + '99' }}
                              />
                              <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl" style={{ backgroundColor: moveGhost.catColor }} />
                              <div className="relative z-10 flex flex-col items-center justify-center h-full px-2 gap-0.5 text-center">
                                <div className="flex items-center gap-1">
                                  <GripVertical className="w-3 h-3 text-foreground/50" />
                                  <span className="text-[10px] font-black text-foreground/80">
                                    {moveGhost.startLabel} – {moveGhost.endLabel}
                                  </span>
                                </div>
                                {moveGhost.isOverlap && (
                                  <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[8px] font-bold">
                                    <AlertTriangle className="w-2 h-2" /> Solapamiento
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* ── Ghost Block de RESIZE de cita existente ── */}
                          {isResizeGhostHere && resizeGhost && (
                            <div
                              className="absolute left-1 right-1 z-20 pointer-events-none overflow-hidden"
                              style={{
                                top: `${resizeGhost.topPx}px`,
                                height: `${resizeGhost.heightPx}px`,
                              }}
                            >
                              <div className="absolute inset-0 rounded-xl border-2 border-dashed border-primary/70 bg-primary/10 backdrop-blur-[2px] shadow-lg" />
                              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-primary/80" />
                              <div className="relative z-10 flex flex-col items-center justify-center h-full px-2 gap-0.5 text-center">
                                <span className="text-[10px] font-black text-primary">
                                  {resizeGhost.startLabel} – {resizeGhost.endLabel}
                                </span>
                                {resizeGhost.heightPx >= 28 && (
                                  <span className="text-[9px] font-bold text-primary/80">
                                    {resizeGhost.durationMin} min
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* ── Hover Guide (cuando no hay drag) ── */}
                          {isHoverHere && !provisionalSlot && !moveGhost && hoveredSlot && (

                            <div
                              className="absolute left-1 right-1 rounded-lg border border-primary/30 bg-primary/5 pointer-events-none z-[1] flex items-center justify-center transition-all duration-75 animate-in fade-in zoom-in-95"
                              style={{
                                top: `${hoveredSlot.top}px`,
                                height: `${hourHeight / 2}px`,
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

                            // ── Umbrales de densidad de contenido ──
                            const isTiny   = heightPx < 38;
                            const isSmall  = heightPx >= 38  && heightPx < 62;
                            const isMedium = heightPx >= 62  && heightPx < 92;
                            const isLarge  = heightPx >= 92;

                            const isSelected     = selectedCitaId === cita.id;
                            const isBeingMoved   = moveRef.current.active && moveRef.current.citaId === cita.id;
                            const isBeingResized = resizeRef.current.active && resizeRef.current.citaId === cita.id;
                            const editable       = canMoveCita(cita);

                            // ── Badge de estado ──
                            const statusBadge: Record<string, { label: string; cls: string }> = {
                              completada:  { label: 'Completada', cls: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
                              cancelada:   { label: 'Cancelada',  cls: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30' },
                              'no-show':   { label: 'No show',    cls: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30' },
                              pendiente:   { label: 'Pendiente',  cls: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30' },
                            };
                            const statInfo = statusBadge[cita.estado];

                            // ── Nombre del cliente abreviado (p. ej. "María G.") ──
                            const fullName = cita.cliente_nombre ?? '';
                            const nameParts = fullName.trim().split(' ');
                            const shortName = nameParts.length > 1
                              ? `${nameParts[0]} ${nameParts[1][0]}.`
                              : nameParts[0] ?? '';

                            // Hora de inicio y fin
                            const startLabel = formatTime12h(cita.hora);
                            const endMin = (cita._startMin ?? 0) + (cita.duracion ?? 0);
                            const endLabel = minutesToLabel(endMin);

                            let tooltipText = `${cita.cliente_nombre}\nHora: ${startLabel} (${cita.duracion} min)\nServicio: ${cita.servicio?.nombre || 'N/A'}\nEstilista: ${cita.empleado?.nombre || 'N/A'}`;
                            if (cita.allowOverlap) tooltipText += `\n[Traslape: ${cita.overlapReason || 'Sin motivo'}]`;
                            if (editable) tooltipText += '\n↕ Mantén presionado para mover';

                            return (
                              <div
                                key={cita.id}
                                title={tooltipText}
                                className={cn(
                                  "booking-card absolute rounded-xl border text-left transition-shadow duration-150 overflow-hidden flex flex-col group select-none",
                                  isBeingMoved || isBeingResized
                                    ? "opacity-35 shadow-none"
                                    : "hover:shadow-lg hover:z-30",
                                  isSelected && editable && "ring-2 ring-primary ring-offset-1 ring-offset-card z-20",
                                  editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                                )}
                                style={{
                                  top:    `${topPx}px`,
                                  height: `${heightPx}px`,
                                  left:   `calc(${leftPct}% + ${gapPx}px)`,
                                  width:  `calc(${widthPct}% - ${gapPx * 2}px)`,
                                  backgroundColor: cita.allowOverlap
                                    ? `color-mix(in srgb, ${catColor} 12%, color-mix(in srgb, #f59e0b 8%, var(--color-card)))`
                                    : `color-mix(in srgb, ${catColor} 14%, var(--color-card))`,
                                  borderColor:  cita.allowOverlap ? '#d97706' : `color-mix(in srgb, ${catColor} 35%, var(--color-border))`,
                                  borderStyle:  cita.allowOverlap ? 'dashed' : 'solid',
                                  borderWidth:  cita.allowOverlap ? '2px' : '1px',
                                  zIndex: isSelected ? 20 : 5,
                                  touchAction: 'none',
                                }}
                                onPointerDown={(e) => handleCitaPointerDown(e, cita, diaStr, emp.id)}
                                onPointerMove={(e) => handleCitaPointerMove(e, cita)}
                                onPointerUp={(e) => handleCitaPointerUp(e, cita)}
                                onPointerCancel={() => { cancelMove(); cancelResize(); }}
                              >
                                {/* Handle de resize SUPERIOR — solo visible cuando seleccionada */}
                                {isSelected && editable && (
                                  <div
                                    className="resize-handle absolute left-0 right-0 -top-3 flex items-center justify-center cursor-n-resize z-30 h-8 group/rh"
                                    onPointerDown={(e) => handleResizePointerDown(e, cita, 'top', diaStr, emp.id)}
                                    onPointerMove={(e) => handleResizePointerMove(e, cita)}
                                    onPointerUp={(e) => handleResizePointerUp(e, cita)}
                                    onPointerCancel={() => cancelResize()}
                                    title="Arrastrar para cambiar la hora de inicio"
                                  >
                                    <div
                                      className="w-12 h-2 rounded-full shadow-sm transition-transform group-hover/rh:scale-110"
                                      style={{ backgroundColor: catColor }}
                                    />
                                  </div>
                                )}

                                {/* Indicador lateral de categoría */}
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl transition-all group-hover:w-2 shrink-0"
                                  style={{ backgroundColor: catColor }}
                                />

                                {/* ─────────── CONTENIDO ADAPTABLE ─────────── */}
                                <div className="pl-2.5 pr-1 pt-1 pb-1 flex flex-col h-full justify-start overflow-hidden">

                                  {/* TINY (<38px): solo nombre abreviado + hora en una línea */}
                                  {isTiny && (
                                    <div className="flex items-center gap-1 h-full overflow-hidden">
                                      <p className="text-[10px] font-black text-foreground leading-none truncate">
                                        {shortName}
                                      </p>
                                      <span className="text-[9px] font-bold text-foreground/60 shrink-0 leading-none">
                                        {startLabel}
                                      </span>
                                    </div>
                                  )}

                                  {/* SMALL (38–62px): nombre + hora de inicio */}
                                  {isSmall && (
                                    <>
                                      <div className="flex items-center gap-1 overflow-hidden">
                                        {cita.allowOverlap && (
                                          <span className="text-amber-500 shrink-0 text-[10px]">⚠</span>
                                        )}
                                        <p className="text-[11px] font-black text-foreground leading-tight truncate">
                                          {shortName}
                                        </p>
                                      </div>
                                      <p className="text-[10px] font-bold text-foreground/70 leading-none mt-0.5 truncate">
                                        {startLabel}
                                      </p>
                                    </>
                                  )}

                                  {/* MEDIUM (62–92px): nombre, rango horario, servicio */}
                                  {isMedium && (
                                    <>
                                      <div className="flex items-center gap-1 overflow-hidden">
                                        {cita.allowOverlap && (
                                          <span className="text-amber-500 shrink-0 text-[10px]">⚠</span>
                                        )}
                                        <p className="text-xs font-black text-foreground leading-tight truncate">
                                          {cita.cliente_nombre}
                                        </p>
                                        {editable && (
                                          <GripVertical className="w-3 h-3 shrink-0 text-foreground/25 ml-auto" />
                                        )}
                                      </div>
                                      <p className="text-[10px] font-bold text-foreground/65 leading-none mt-0.5 truncate">
                                        {startLabel} · {cita.duracion} min
                                      </p>
                                      {cita.servicio?.nombre && (
                                        <span className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-foreground/75 truncate">
                                          <Scissors className="w-2.5 h-2.5 shrink-0" style={{ color: catColor }} />
                                          {cita.servicio.nombre}
                                        </span>
                                      )}
                                    </>
                                  )}

                                  {/* LARGE (≥92px): todo el detalle */}
                                  {isLarge && (
                                    <>
                                      {/* Fila superior: nombre + grip */}
                                      <div className="flex items-start gap-1 overflow-hidden">
                                        <div className="flex items-center gap-1 flex-1 overflow-hidden min-w-0">
                                          {cita.allowOverlap && (
                                            <span
                                              className="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold text-[9px] shrink-0"
                                              title={`Traslape: ${cita.overlapReason || 'Sin motivo'}`}
                                            >⚠</span>
                                          )}
                                          <p className="text-xs font-black text-foreground leading-tight truncate">
                                            {cita.cliente_nombre}
                                          </p>
                                        </div>
                                        {editable && (
                                          <GripVertical className="w-3.5 h-3.5 shrink-0 text-foreground/20 mt-0.5" />
                                        )}
                                      </div>

                                      {/* Rango horario */}
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <Clock className="w-2.5 h-2.5 shrink-0 text-foreground/50" />
                                        <span className="text-[10px] font-bold text-foreground/70 truncate">
                                          {startLabel} – {endLabel}
                                        </span>
                                        <span className="text-[9px] text-foreground/45 shrink-0">
                                          {cita.duracion} min
                                        </span>
                                      </div>

                                      {/* Servicio */}
                                      {cita.servicio?.nombre && (
                                        <span className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-foreground/80 truncate">
                                          <Scissors className="w-2.5 h-2.5 shrink-0" style={{ color: catColor }} />
                                          {cita.servicio.nombre}
                                        </span>
                                      )}

                                      {/* Colaborador (solo vista 'all') */}
                                      {scope === 'all' && cita.empleado?.nombre && (
                                        <span className="flex items-center gap-1 mt-0.5 text-[10px] font-medium text-foreground/65 truncate">
                                          <User className="w-2.5 h-2.5 shrink-0" style={{ color: catColor }} />
                                          {cita.empleado.nombre.split(' ')[0]}
                                        </span>
                                      )}

                                      {/* Badge de estado */}
                                      {statInfo && heightPx >= 110 && (
                                        <span className={cn(
                                          "inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md border text-[9px] font-bold w-fit",
                                          statInfo.cls
                                        )}>
                                          {statInfo.label}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Handle de resize INFERIOR — solo visible cuando seleccionada */}
                                {isSelected && editable && (
                                  <div
                                    className="resize-handle absolute left-0 right-0 -bottom-3 flex items-center justify-center cursor-s-resize z-30 h-8 group/rb"
                                    onPointerDown={(e) => handleResizePointerDown(e, cita, 'bottom', diaStr, emp.id)}
                                    onPointerMove={(e) => handleResizePointerMove(e, cita)}
                                    onPointerUp={(e) => handleResizePointerUp(e, cita)}
                                    onPointerCancel={() => cancelResize()}
                                    title="Arrastrar para cambiar la hora de fin"
                                  >
                                    <div
                                      className="w-12 h-2 rounded-full shadow-sm transition-transform group-hover/rb:scale-110"
                                      style={{ backgroundColor: catColor }}
                                    />
                                  </div>
                                )}
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

      {/* ── BARRA DE CONFIRMACIÓN PROVISIONAL ────────────────────────────────── */}
      {provisionalSlot && (
        <div
          className="sticky bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-2 fade-in duration-150"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className={cn(
            "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-t shadow-2xl bg-card/95 backdrop-blur-[8px]",
            provisionalSlot.isOverlap ? "border-amber-500/40" : "border-primary/20"
          )}>
            <div className={cn(
              "w-1 h-10 rounded-full shrink-0",
              provisionalSlot.isOverlap ? "bg-amber-500" : "bg-primary"
            )} />
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Clock className={cn("w-3.5 h-3.5 shrink-0", provisionalSlot.isOverlap ? "text-amber-500" : "text-primary")} />
                <span className="text-sm font-black text-foreground leading-none truncate">
                  {minutesToLabel(provisionalSlot.startMin)} – {minutesToLabel(provisionalSlot.endMin)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {provisionalSlot.endMin - provisionalSlot.startMin} min
                </span>
                {provisionalSlot.isOverlap && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> Solapamiento
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearProvisionalSlot(); }}
              className="h-9 px-3 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted/60 transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cancelar</span>
            </button>
            <Button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleConfirmProvisional(); }}
              className="h-9 px-4 text-xs font-black bg-primary text-primary-foreground hover:bg-primary/90 shadow-md rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Agendar
            </Button>
          </div>
        </div>
      )}

      {/* ── SNACKBAR DE DESHACER ─────────────────────────────────────────────── */}
      {snackbar.visible && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-3 fade-in duration-200">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-foreground text-background shadow-2xl border border-border/20 text-xs font-semibold max-w-[320px]">
            <span className="truncate">{snackbar.message}</span>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-bold text-[11px] hover:bg-primary/80 transition-colors shrink-0 cursor-pointer"
            >
              <Undo2 className="w-3 h-3" /> Deshacer
            </button>
            <button
              onClick={dismissSnackbar}
              className="p-0.5 rounded hover:bg-background/20 transition-colors shrink-0 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
