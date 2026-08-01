export interface CalendarAppointment {
  id: string;
  fecha: string;
  hora: string;
  duracion: number;
  empleado_id: string;
  estado: string;
  cliente_nombre: string;
  cliente_telefono?: string | null;
  servicio?: {
    id?: string;
    nombre?: string;
    duracion?: number;
    categoriaRel?: { nombre?: string; color?: string } | null;
  };
  empleado?: {
    id?: string;
    nombre?: string;
    correo?: string | null;
    tituloCliente?: string | null;
  };
  citaServicios?: Array<{
    id?: string;
    servicio_id: string;
    duracion: number;
    servicio?: {
      id?: string;
      nombre?: string;
      duracion?: number;
      categoriaRel?: { nombre?: string; color?: string } | null;
    };
  }>;
  updated_at?: string;
  [key: string]: any;
}

export interface CalendarEmployee {
  id: string;
  nombre: string;
  [key: string]: any;
}

export interface CalendarUser {
  id?: string;
  rol?: string;
  [key: string]: any;
}

export interface AppointmentCalendarProps {
  citas: CalendarAppointment[];
  empleados: CalendarEmployee[];
  filtroEmpleado: string;
  scope: string;
  user: CalendarUser | null;
  onEditCita: (cita: CalendarAppointment) => void;
  onViewCita?: (cita: CalendarAppointment) => void;
  onSlotClick: (params: { date: string; time: string; empleadoId: string; durationMinutes: number }) => void;
  onMoveCita?: (params: {
    citaId: string;
    fecha: string;
    hora: string;
    empleadoId: string;
    duracion: number;
    clientUpdatedAt: string;
  }) => Promise<{ error?: string; type?: string; conflicts?: unknown[] } | void>;
  localCitaOverrides?: Record<string, { fecha?: string; hora?: string; duracion?: number; empleado_id?: string }>;
  selectedDateStr: string;
  setSelectedDateStr: (date: string) => void;
  isLoading?: boolean;
  isModalOpen?: boolean;
}

export interface ProvisionalSlot {
  dayStr: string;
  empleadoId: string;
  startMin: number;
  endMin: number;
  isOverlap?: boolean;
}

export interface ProvisionalDragRef {
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

export interface MoveState {
  active: boolean;
  citaId: string;
  cita: CalendarAppointment | null;
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
  grabOffsetY: number;
  targetEl: HTMLElement | null;
  pending: boolean;
}

export interface ResizeState {
  active: boolean;
  citaId: string;
  cita: CalendarAppointment | null;
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

export interface SnackbarState {
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
