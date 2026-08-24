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
  | 'prepareUpdateAppointmentStatus'
  | 'prepareUpdateAppointmentStatusByQuery'
  | 'prepareAddWaitlist'
  | 'prepareAddClientPreference'
  | 'prepareWhatsAppReminder';

export interface IAPendingAction {
  type: 'CREATE_CLIENT' | 'CREATE_APPOINTMENT' | 'UPDATE_APPOINTMENT_STATUS' | 'ADD_WAITLIST' | 'ADD_CLIENT_PREFERENCE' | 'OPEN_WHATSAPP_REMINDER';
  title: string;
  description: string;
  confirmLabel: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PATCH';
  body: Record<string, unknown>;
  details: Array<{ label: string; value: string }>;
}

export type IAAppointmentDraftField = 'cliente' | 'servicio' | 'profesional' | 'fecha' | 'hora';

export interface IAAppointmentDraft {
  clienteId?: string;
  cliente?: string;
  telefono?: string;
  servicioId?: string;
  servicio?: string;
  profesional?: string;
  fecha?: string;
  hora?: string;
  notas?: string;
  awaitingField?: IAAppointmentDraftField;
}

export interface IAChoiceOption {
  id: string;
  label: string;
  description: string;
}

export interface IAChoiceRequest {
  kind: 'client';
  prompt: string;
  options: IAChoiceOption[];
  appointmentDraft?: IAAppointmentDraft;
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

export interface IAAssistantResponse {
  text: string;
  toolsUsed: string[];
  mode: string;
  pendingAction?: IAPendingAction;
  appointmentDraft?: IAAppointmentDraft;
  clientDraft?: IAClientDraft;
  choiceRequest?: IAChoiceRequest;
}

export type IAToolResult =
  | { ok: true; data: unknown; meta: { fuenteDatos: string }; pendingAction?: IAPendingAction }
  | { ok: false; error: string; code: 'ACCESS_DENIED' | 'INVALID_PARAMS' | 'INTERNAL_ERROR'; choiceRequest?: IAChoiceRequest };

export interface IAExecutionContext {
  userId: string;
  userRole: IAUserRole;
}
