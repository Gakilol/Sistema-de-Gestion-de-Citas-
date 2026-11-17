import { z } from 'zod';

export const AssistantIntentSchema = z.object({
  accion: z.enum(['ayuda', 'agenda', 'disponibilidad', 'resumen', 'borrador']),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  servicios: z.array(z.string().regex(/^s\d+$/)).max(10).optional(),
  profesional: z.string().regex(/^e\d+$/).optional(),
  periodo: z.enum(['dia', 'semana', 'mes']).optional(),
  horaAmbigua: z.boolean().optional(),
}).strict();
export type AssistantIntent = z.infer<typeof AssistantIntentSchema>;
export type AssistantMode = 'gemini' | 'local';
export interface ServiceOption { id: string; nombre: string; duracion: number }
export interface EmployeeOption { id: string; nombre: string }
export interface ClientOption { id: string; nombre: string; telefono: string | null }
export interface DraftPayload {
  clienteId: string | null;
  empleadoId: string | null;
  servicios: { id: string; nombre: string; duracion: number }[];
  fecha: string | null;
  hora: string | null;
}
export interface DraftView extends DraftPayload {
  id: string;
  revision: number;
  clienteNombre: string | null;
  profesionalNombre: string | null;
  expiresAt: string;
  listo: boolean;
  faltantes: string[];
}
export interface AgendaRow {
  id: string; cliente: string; profesional: string; servicios: string; fecha: string; hora: string; estado: string;
}
export interface AssistantReply {
  text: string;
  mode: AssistantMode;
  fallbackReason?: string;
  draft?: DraftView;
  agenda?: AgendaRow[];
  horarios?: string[];
  horarioContexto?: { fecha: string; servicios: string[]; empleadoId: string };
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
  borradorId: z.string().uuid(), revision: z.number().int().positive(),
}).strict();
export const DraftPayloadSchema = z.object({
  clienteId: z.string().uuid().nullable(), empleadoId: z.string().uuid().nullable(),
  servicios: z.array(z.object({ id: z.string().uuid(), nombre: z.string(), duracion: z.number().int().positive() })).max(10),
  fecha: z.string().nullable(), hora: z.string().nullable(),
});
