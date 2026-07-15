// lib/calendar-drag-utils.ts
// Utilidades de tiempo, snap y traslape para el gestor de selección en el Calendario / Agenda NovaCita

export const HORA_INICIO = 7; // 7 AM
export const HORA_FIN = 20;   // 8 PM
export const TOTAL_HORAS = HORA_FIN - HORA_INICIO + 1;
export const HOUR_HEIGHT = 80; // 1 hora = 80px
export const SLOT_HEIGHT = HOUR_HEIGHT / 4; // 15 min por defecto = 20px
export const MIN_HEIGHT = 42;  // 42px min height
export const MIN_DRAG_MINUTES = 5; // Duración mínima de la selección al crear (5 minutos)
export const TOUCH_LONG_PRESS_MS = 350; // Retardo long-press para toque
export const TOUCH_MOVE_THRESHOLD = 8; // Umbral de movimiento en px para cancelar long-press
export const MOUSE_MOVE_THRESHOLD = 5; // Umbral de movimiento en px para iniciar drag en mouse

// ─── Constantes para edición visual de citas existentes ──────────────────────

/** Duración mínima permitida al redimensionar una cita (minutos) */
export const MIN_APPOINTMENT_MINUTES = 15;

/** Altura en px de los handles de resize (superior e inferior de la cita) */
export const RESIZE_HANDLE_PX = 10;

/** Tiempo long-press para activar modo mover en una cita existente (touch) */
export const CITA_MOVE_LONG_PRESS_MS = 400;

/** Umbral de movimiento en px para que un mouse drag en cita existente active el modo mover (vs. clic simple) */
export const CITA_MOVE_MOUSE_THRESHOLD = 6;

/** Estados en los que una cita puede ser movida o redimensionada visualmente */
export const DRAGGABLE_STATES = ['PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'REPROGRAMADA'] as const;

export type DraggableState = typeof DRAGGABLE_STATES[number];

/** Retorna true si la cita puede ser arrastrada/redimensionada según su estado */
export function isCitaEditable(estado: string): boolean {
  return DRAGGABLE_STATES.includes(estado as DraggableState);
}

import { formatHora12h } from '@/lib/time-utils';

/** Snap a cualquier paso de minutos (por defecto 15 min) */
export const snapToStep = (minutes: number, step = 15): number => {
  return Math.round(minutes / step) * step;
};

/** Convierte una posición Y dentro de una columna a minutos desde medianoche */
export const yToMinutes = (y: number, step = 15): number => {
  const rawMinutes = (y / HOUR_HEIGHT) * 60;
  const totalMinutes = HORA_INICIO * 60 + rawMinutes;
  const snapped = snapToStep(totalMinutes, step);
  return Math.min(Math.max(HORA_INICIO * 60, snapped), HORA_FIN * 60);
};

/** Convierte minutos desde medianoche a posición Y en px */
export const minutesToY = (minutes: number): number => {
  return ((minutes - HORA_INICIO * 60) / 60) * HOUR_HEIGHT;
};

/** Formatea minutos desde medianoche a string 24h "HH:MM" */
export const minutesToTimeStr = (minutes: number): string => {
  const clamped = Math.min(Math.max(0, minutes), 24 * 60);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Convierte "HH:MM" a minutos desde medianoche */
export const timeStrToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Formatea "HH:MM" a formato 12 horas AM/PM */
export const formatTime12h = (timeStr: string): string => {
  return formatHora12h(timeStr);
};

/** Formatea minutos desde medianoche a formato 12 horas AM/PM */
export const minutesToLabel = (minutes: number): string => {
  return formatHora12h(minutesToTimeStr(minutes));
};

/** Verifica si una cita existente en el mismo día y empleado se traslapa con un rango de minutos */
export const checkOverlap = (
  citasDia: any[],
  empleadoId: string,
  startMin: number,
  endMin: number
): boolean => {
  if (!citasDia || citasDia.length === 0) return false;
  return citasDia.some((c) => {
    if (c.empleado_id !== empleadoId && c.empleado?.id !== empleadoId) return false;
    const citaStart = timeStrToMinutes(c.hora);
    const citaEnd = citaStart + (c.duracion || 30);
    // Hay traslape si el rango A interactúa con el rango B
    return startMin < citaEnd && endMin > citaStart;
  });
};
