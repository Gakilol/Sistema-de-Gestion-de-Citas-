import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/db';
import {
  AssistantIntentSchema,
  type AssistantIntent,
  type AssistantMode,
  type DraftOperation,
  type PendingField,
} from './domain';

const responseSchema = {
  type: 'object',
  required: ['accion'],
  additionalProperties: false,
  properties: {
    accion: {
      type: 'string',
      enum: ['ayuda', 'agenda', 'disponibilidad', 'resumen', 'borrador', 'reprogramar', 'cancelar', 'confirmar_resumen', 'descartar'],
    },
    fecha: { type: 'string' },
    hora: { type: 'string' },
    franja: { type: 'string', enum: ['manana', 'tarde', 'noche'] },
    servicios: { type: 'array', items: { type: 'string' } },
    profesional: { type: 'string' },
    periodo: { type: 'string', enum: ['dia', 'semana', 'mes'] },
    horaAmbigua: { type: 'boolean' },
    opcionIndice: { type: 'integer' },
    seleccionUltima: { type: 'boolean' },
    cualquierProfesional: { type: 'boolean' },
  },
};

export interface ProviderPromptContext {
  hasDraft?: boolean;
  activeOperation?: DraftOperation | null;
  pendingField?: PendingField | null;
  offeredCount?: number;
}

/** Bounded rows per user, serialised globally: quotas work across serverless instances. */
export async function reserveProviderRequest(userId: string, now = new Date()): Promise<boolean> {
  const minute = new Date(Math.floor(now.getTime() / 60000) * 60000);
  // Provider daily quota resets at midnight Pacific; application UTC window is an additional limit.
  const day = new Date(Math.floor(now.getTime() / 86400000) * 86400000);
  const windows = [
    { clave: 'global:minute', ventana: minute, max: 5 },
    { clave: 'global:day', ventana: day, max: 50 },
    { clave: `${userId}:minute`, ventana: minute, max: 3 },
    { clave: `${userId}:day`, ventana: day, max: 30 },
  ];
  return prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('novacita-ia-quota'))`;
    const current = await tx.iaLimite.findMany({ where: { clave: { in: windows.map(window => window.clave) } } });
    if (windows.some(window => {
      const row = current.find(item => item.clave === window.clave);
      return row && row.ventana.getTime() === window.ventana.getTime() && row.cantidad >= window.max;
    })) return false;
    for (const window of windows) {
      const row = current.find(item => item.clave === window.clave);
      const cantidad = row?.ventana.getTime() === window.ventana.getTime() ? row.cantidad + 1 : 1;
      await tx.iaLimite.upsert({
        where: { clave: window.clave },
        create: { clave: window.clave, ventana: window.ventana, cantidad },
        update: { ventana: window.ventana, cantidad },
      });
    }
    return true;
  });
}

export async function interpretCommand(
  safeText: string,
  today: string,
  local: AssistantIntent,
  userId: string,
  context?: ProviderPromptContext,
): Promise<{ intent: AssistantIntent; mode: AssistantMode; fallbackReason?: string }> {
  const fallback = (reason: string) => ({ intent: local, mode: 'local' as AssistantMode, fallbackReason: reason });
  if (!process.env.GEMINI_API_KEY) return fallback('not_configured');
  try {
    if (!await reserveProviderRequest(userId)) return fallback('quota');
  } catch {
    return fallback('quota_unavailable');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const promptPayload: Record<string, unknown> = {
      instruccion: safeText,
      hoy: today,
      borradorActivo: context?.hasDraft ?? (local.accion === 'borrador' || local.accion === 'reprogramar' || local.accion === 'cancelar'),
    };
    if (context?.activeOperation) promptPayload.operacionActiva = context.activeOperation;
    if (context?.pendingField) promptPayload.esperando = context.pendingField;
    if (typeof context?.offeredCount === 'number' && context.offeredCount > 0) {
      promptPayload.opcionesDisponibles = context.offeredCount;
    }

    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      contents: JSON.stringify(promptPayload),
      config: {
        systemInstruction:
          'Interpreta comandos operativos en español de una agenda de citas. Devuelve solo el JSON del esquema. sN, eN y c0 son referencias opacas (servicio, profesional, cliente); nunca inventes referencias ni datos personales. No tienes acceso a base de datos ni puedes crear, reprogramar ni cancelar citas directamente. Solo incluye fecha, hora, franja, servicios, profesional u opcionIndice si están explícitos en el comando. Fecha relativa usa hoy. Horas de 1 a 12 sin mañana/tarde/noche son ambiguas. «la primera» es opcionIndice 0, «la segunda» es 1, etc. «sí, confirma» o «confirma» es accion confirmar_resumen. Una modificación de borrador activo conserva borrador, reprogramar o cancelar. No incluyas texto libre.',
        responseMimeType: 'application/json',
        responseJsonSchema: responseSchema,
        temperature: 0,
        maxOutputTokens: 600,
        abortSignal: controller.signal,
      },
    });
    const result = AssistantIntentSchema.safeParse(JSON.parse(response.text || '{}'));
    if (!result.success) return fallback('invalid_response');
    const tokens = new Set(safeText.split(' '));
    if (
      result.data.servicios?.some(ref => !tokens.has(ref))
      || (result.data.profesional && !tokens.has(result.data.profesional))
    ) {
      return fallback('invalid_reference');
    }
    // Local explicit parsing wins for dates, times, ordinals, confirmation signals, and privacy flags.
    const merged: AssistantIntent = {
      ...result.data,
      ...(local.accion === 'confirmar_resumen' || local.accion === 'descartar' ? { accion: local.accion } : {}),
      ...(local.fecha ? { fecha: local.fecha } : {}),
      ...(local.hora ? { hora: local.hora } : {}),
      ...(local.franja ? { franja: local.franja } : {}),
      ...(local.servicios?.length ? { servicios: local.servicios } : {}),
      ...(local.profesional ? { profesional: local.profesional } : {}),
      ...(local.opcionIndice !== undefined ? { opcionIndice: local.opcionIndice } : {}),
      ...(local.seleccionUltima ? { seleccionUltima: true } : {}),
      ...(local.tieneCliente ? { tieneCliente: true } : {}),
      ...(local.cualquierProfesional ? { cualquierProfesional: true } : {}),
      ...(local.cambioExplicitoFecha ? { cambioExplicitoFecha: true } : {}),
      horaAmbigua: local.hora ? local.horaAmbigua : result.data.horaAmbigua,
    };
    return { intent: merged, mode: 'gemini' as AssistantMode };
  } catch {
    return fallback(controller.signal.aborted ? 'timeout' : 'provider_unavailable');
  } finally {
    clearTimeout(timeout);
  }
}
