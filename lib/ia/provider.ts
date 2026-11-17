import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/db';
import { AssistantIntentSchema, type AssistantIntent, type AssistantMode } from './domain';

const responseSchema = {
  type: 'object', required: ['accion'], additionalProperties: false,
  properties: {
    accion: { type: 'string', enum: ['ayuda', 'agenda', 'disponibilidad', 'resumen', 'borrador'] },
    fecha: { type: 'string' }, hora: { type: 'string' },
    servicios: { type: 'array', items: { type: 'string' } }, profesional: { type: 'string' },
    periodo: { type: 'string', enum: ['dia', 'semana', 'mes'] }, horaAmbigua: { type: 'boolean' },
  },
};

/** Bounded rows per user, serialised globally: quotas work across serverless instances. */
export async function reserveProviderRequest(userId: string, now = new Date()): Promise<boolean> {
  const minute = new Date(Math.floor(now.getTime() / 60000) * 60000);
  // Provider daily quota resets at midnight Pacific; application UTC window is an additional limit.
  const day = new Date(Math.floor(now.getTime() / 86400000) * 86400000);
  const windows = [
    { clave: 'global:minute', ventana: minute, max: 5 }, { clave: 'global:day', ventana: day, max: 50 },
    { clave: `${userId}:minute`, ventana: minute, max: 3 }, { clave: `${userId}:day`, ventana: day, max: 30 },
  ];
  return prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('novacita-ia-quota'))`;
    const current = await tx.iaLimite.findMany({ where: { clave: { in: windows.map(window => window.clave) } } });
    if (windows.some(window => {
      const row = current.find(item => item.clave === window.clave);
      return row && row.ventana.getTime() === window.ventana.getTime() && row.cantidad >= window.max;
    })) return false;
    for (const window of windows) {
      const row = current.find(item => item.clave === window.clave);
      const cantidad = row?.ventana.getTime() === window.ventana.getTime() ? row.cantidad + 1 : 1;
      await tx.iaLimite.upsert({ where: { clave: window.clave }, create: { clave: window.clave, ventana: window.ventana, cantidad }, update: { ventana: window.ventana, cantidad } });
    }
    return true;
  });
}

export async function interpretCommand(safeText: string, today: string, local: AssistantIntent, userId: string): Promise<{ intent: AssistantIntent; mode: AssistantMode; fallbackReason?: string }> {
  const fallback = (reason: string) => ({ intent: local, mode: 'local' as AssistantMode, fallbackReason: reason });
  if (!process.env.GEMINI_API_KEY) return fallback('not_configured');
  if (!await reserveProviderRequest(userId)) return fallback('quota');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      contents: JSON.stringify({ instruccion: safeText, hoy: today, borradorActivo: local.accion === 'borrador' }),
      config: {
        systemInstruction: 'Interpreta comandos operativos en español de una agenda. Devuelve solo el JSON del esquema. sN y eN son referencias opacas; no inventes referencias. No tienes herramientas ni puedes registrar nada. Solo incluye fecha, hora, servicios o profesional si están explícitos en el comando. Fecha relativa usa hoy. Horas de 1 a 12 sin mañana/tarde/noche son ambiguas. Una modificación del borrador tiene accion borrador. No incluyas datos personales ni texto libre.',
        responseMimeType: 'application/json', responseJsonSchema: responseSchema,
        temperature: 0, maxOutputTokens: 600, abortSignal: controller.signal,
      },
    });
    const result = AssistantIntentSchema.safeParse(JSON.parse(response.text || '{}'));
    if (!result.success) return fallback('invalid_response');
    const tokens = new Set(safeText.split(' '));
    if (result.data.servicios?.some(ref => !tokens.has(ref)) || (result.data.profesional && !tokens.has(result.data.profesional))) return fallback('invalid_reference');
    // Local explicit date/time parsing wins over inference; incomplete speech never chooses AM/PM silently.
    return { intent: { ...result.data, ...(local.fecha ? { fecha: local.fecha } : {}), ...(local.hora ? { hora: local.hora } : {}), horaAmbigua: local.horaAmbigua || result.data.horaAmbigua }, mode: 'gemini' as AssistantMode };
  } catch {
    return fallback(controller.signal.aborted ? 'timeout' : 'provider_unavailable');
  } finally { clearTimeout(timeout); }
}
