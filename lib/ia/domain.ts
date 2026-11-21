import { z } from 'zod';

export const DraftOperationSchema = z.enum(['crear', 'reprogramar', 'cancelar']);
export type DraftOperation = z.infer<typeof DraftOperationSchema>;

export const TimeOfDayWindowSchema = z.enum(['manana', 'tarde', 'noche']);
export type TimeOfDayWindow = z.infer<typeof TimeOfDayWindowSchema>;

export const PendingFieldSchema = z.enum([
  'cliente',
  'servicio',
  'profesional',
  'fecha',
  'hora',
  'cita',
  'confirmacion',
]);
export type PendingField = z.infer<typeof PendingFieldSchema>;

export const AssistantIntentSchema = z.object({
  accion: z.enum([
    'ayuda',
    'agenda',
    'disponibilidad',
    'resumen',
    'borrador',
    'reprogramar',
    'cancelar',
    'confirmar_resumen',
    'descartar',
  ]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  franja: TimeOfDayWindowSchema.optional(),
  servicios: z.array(z.string().regex(/^s\d+$/)).max(10).optional(),
  profesional: z.string().regex(/^e\d+$/).optional(),
  periodo: z.enum(['dia', 'semana', 'mes']).optional(),
  horaAmbigua: z.boolean().optional(),
  opcionIndice: z.number().int().min(0).max(10).optional(),
  seleccionUltima: z.boolean().optional(),
  tieneCliente: z.boolean().optional(),
  cualquierProfesional: z.boolean().optional(),
  cambioExplicitoFecha: z.boolean().optional(),
}).strict();

export type AssistantIntent = z.infer<typeof AssistantIntentSchema>;
export type AssistantMode = 'gemini' | 'local';

export interface ServiceOption { id: string; nombre: string; duracion: number }
export interface EmployeeOption { id: string; nombre: string }
export interface ClientOption { id: string; nombre: string; telefono: string | null }

export interface OfferedSlot {
  fecha: string;
  hora: string;
  empleadoId: string;
  empleadoNombre: string;
}

export interface ClientCandidate {
  id: string;
  nombre: string;
  pista: string | null;
}

export interface AppointmentCandidate {
  id: string;
  clienteId: string | null;
  clienteNombre: string;
  empleadoId: string;
  profesionalNombre: string;
  servicios: ServiceOption[];
  fecha: string;
  hora: string;
  estado: string;
  updatedAt: string;
}

export interface TargetAppointmentSummary {
  clienteNombre: string;
  profesionalNombre: string;
  servicios: string;
  fecha: string;
  hora: string;
  estado: string;
}

export interface DraftPayload {
  clienteId: string | null;
  empleadoId: string | null;
  empleadoFijado?: boolean;
  servicios: ServiceOption[];
  fecha: string | null;
  hora: string | null;
  operacion?: DraftOperation;
  franja?: TimeOfDayWindow | null;
  citaObjetivoId?: string | null;
  citaObjetivoUpdatedAt?: string | null;
  citaObjetivoResumen?: TargetAppointmentSummary | null;
  motivoCancelacion?: string | null;
  horariosOfrecidos?: OfferedSlot[];
  clientesCandidatos?: ClientCandidate[];
  serviciosCandidatos?: ServiceOption[];
  profesionalesCandidatos?: EmployeeOption[];
  citasCandidatas?: AppointmentCandidate[];
  pendiente?: PendingField | null;
  confirmacionSolicitada?: boolean;
}

export interface DraftView extends DraftPayload {
  id: string;
  revision: number;
  operacion: DraftOperation;
  clienteNombre: string | null;
  profesionalNombre: string | null;
  expiresAt: string;
  listo: boolean;
  faltantes: string[];
}

export interface AgendaRow {
  id: string;
  cliente: string;
  profesional: string;
  servicios: string;
  fecha: string;
  hora: string;
  estado: string;
}

export interface AssistantReply {
  text: string;
  spokenText?: string;
  mode: AssistantMode;
  fallbackReason?: string;
  draft?: DraftView | null;
  draftCleared?: boolean;
  highlightConfirmation?: boolean;
  agenda?: AgendaRow[];
  horarios?: string[];
  horariosOfrecidos?: OfferedSlot[];
  horarioContexto?: { fecha: string; servicios: string[]; empleadoId?: string | null };
  clientesCandidatos?: ClientCandidate[];
  serviciosCandidatos?: ServiceOption[];
  profesionalesCandidatos?: EmployeeOption[];
  citasCandidatas?: AppointmentCandidate[];
  resumen?: Record<string, number>;
}

export const ChatInputSchema = z.object({
  mensaje: z.string().trim().min(1).max(1500),
  clienteId: z.string().uuid().nullable().optional(),
  empleadoId: z.string().uuid().nullable().optional(),
  borradorId: z.string().uuid().optional(),
  revision: z.number().int().positive().optional(),
}).strict();

export const ConfirmInputSchema = z.object({
  borradorId: z.string().uuid(),
  revision: z.number().int().positive(),
}).strict();

const ServiceOptionSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  duracion: z.number().int().positive(),
});

const OfferedSlotSchema = z.object({
  fecha: z.string(),
  hora: z.string(),
  empleadoId: z.string().uuid(),
  empleadoNombre: z.string(),
});

const ClientCandidateSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  pista: z.string().nullable(),
});

const EmployeeCandidateSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
});

const AppointmentCandidateSchema = z.object({
  id: z.string().uuid(),
  clienteId: z.string().uuid().nullable(),
  clienteNombre: z.string(),
  empleadoId: z.string().uuid(),
  profesionalNombre: z.string(),
  servicios: z.array(ServiceOptionSchema).max(10),
  fecha: z.string(),
  hora: z.string(),
  estado: z.string(),
  updatedAt: z.string(),
});

const TargetAppointmentSummarySchema = z.object({
  clienteNombre: z.string(),
  profesionalNombre: z.string(),
  servicios: z.string(),
  fecha: z.string(),
  hora: z.string(),
  estado: z.string(),
});

export const DraftPayloadSchema = z.object({
  clienteId: z.string().uuid().nullable(),
  empleadoId: z.string().uuid().nullable(),
  empleadoFijado: z.boolean().optional(),
  servicios: z.array(ServiceOptionSchema).max(10),
  fecha: z.string().nullable(),
  hora: z.string().nullable(),
  operacion: DraftOperationSchema.optional(),
  franja: TimeOfDayWindowSchema.nullable().optional(),
  citaObjetivoId: z.string().uuid().nullable().optional(),
  citaObjetivoUpdatedAt: z.string().nullable().optional(),
  citaObjetivoResumen: TargetAppointmentSummarySchema.nullable().optional(),
  motivoCancelacion: z.string().max(300).nullable().optional(),
  horariosOfrecidos: z.array(OfferedSlotSchema).max(12).optional(),
  clientesCandidatos: z.array(ClientCandidateSchema).max(8).optional(),
  serviciosCandidatos: z.array(ServiceOptionSchema).max(10).optional(),
  profesionalesCandidatos: z.array(EmployeeCandidateSchema).max(10).optional(),
  citasCandidatas: z.array(AppointmentCandidateSchema).max(10).optional(),
  pendiente: PendingFieldSchema.nullable().optional(),
  confirmacionSolicitada: z.boolean().optional(),
});
