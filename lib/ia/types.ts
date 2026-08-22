export type IAUserRole = 'ADMIN' | 'EMPLEADO' | 'TECH_SUPPORT';

export type IAToolName =
  | 'getTodayAppointments'
  | 'getAppointmentSummary'
  | 'searchClients'
  | 'searchServices'
  | 'getAvailableSlots'
  | 'getPopularServices'
  | 'getStaffWorkload'
  | 'prepareCreateClient'
  | 'prepareCreateAppointment'
  | 'prepareUpdateAppointmentStatus';

export interface IAPendingAction {
  type: 'CREATE_CLIENT' | 'CREATE_APPOINTMENT' | 'UPDATE_APPOINTMENT_STATUS';
  title: string;
  description: string;
  confirmLabel: string;
  endpoint: string;
  method: 'POST' | 'PATCH';
  body: Record<string, unknown>;
  details: Array<{ label: string; value: string }>;
}

export type IAAppointmentDraftField = 'cliente' | 'servicio' | 'profesional' | 'fecha' | 'hora';

export interface IAAppointmentDraft {
  cliente?: string;
  telefono?: string;
  servicio?: string;
  profesional?: string;
  fecha?: string;
  hora?: string;
  notas?: string;
  awaitingField?: IAAppointmentDraftField;
}

export interface IAClientDraft {
  nombre?: string;
  telefono?: string;
  email?: string;
  notas?: string;
  awaitingField?: 'nombre';
}

export interface IAConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  appointmentDraft?: IAAppointmentDraft;
  clientDraft?: IAClientDraft;
}

export type IAToolResult =
  | { ok: true; data: unknown; meta: { fuenteDatos: string }; pendingAction?: IAPendingAction }
  | { ok: false; error: string; code: 'ACCESS_DENIED' | 'INVALID_PARAMS' | 'INTERNAL_ERROR' };

export interface IAExecutionContext {
  userId: string;
  userRole: IAUserRole;
}
