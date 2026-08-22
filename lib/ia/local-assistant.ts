import { checkToolPermission } from './permissions';
import { executeIATool } from './tools';
import type { IAExecutionContext, IAToolName } from './types';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function extractDays(value: string, fallback = 30) {
  const match = normalize(value).match(/(\d{1,3})\s*dias?/);
  return match ? Math.max(1, Math.min(180, Number(match[1]))) : fallback;
}

export function detectLocalIntent(message: string): { tool?: IAToolName; args: Record<string, unknown> } {
  const text = normalize(message);
  if (/citas? de hoy|agenda de hoy|quien viene hoy/.test(text)) return { tool: 'getTodayAppointments', args: {} };
  if (/resumen|cuantas citas|estado.*citas|panorama/.test(text)) return { tool: 'getAppointmentSummary', args: {} };
  if (/servicios?.*(popular|solicitado|frecuente)|mas pedidos/.test(text)) return { tool: 'getPopularServices', args: { dias: extractDays(message) } };
  if (/carga.*(equipo|personal)|citas por (empleado|estilista|barbero)|productividad/.test(text)) return { tool: 'getStaffWorkload', args: { dias: extractDays(message) } };
  const clientMatch = message.match(/(?:busca|buscar|encuentra|cliente)\s+(?:al?\s+cliente\s+)?(.+)/i);
  if (clientMatch?.[1]?.trim()) return { tool: 'searchClients', args: { query: clientMatch[1].trim(), limit: 8 } };
  return { args: {} };
}

function rows(data: unknown) {
  if (!Array.isArray(data) || data.length === 0) return 'No encontré registros para esa consulta.';
  return data.map((item) => `- ${Object.entries(item as Record<string, unknown>).map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value ?? '—'}`).join(' · ')}`).join('\n');
}

export async function runLocalAssistant(message: string, context: IAExecutionContext) {
  const intent = detectLocalIntent(message);
  if (!intent.tool) {
    return {
      text: 'Puedo consultar la agenda de hoy, resumir los estados de las citas, buscar clientes, mostrar los servicios más solicitados y revisar la carga del equipo. Prueba con “¿Quién viene hoy?” o “Busca al cliente Ana”.',
      toolsUsed: [],
      mode: 'local_operational',
    };
  }
  if (!checkToolPermission(intent.tool, context.userRole)) {
    return { text: 'Tu rol no tiene permiso para realizar esa consulta.', toolsUsed: [], mode: 'local_operational' };
  }
  const result = await executeIATool(intent.tool, intent.args, context);
  if (!result.ok) return { text: result.error, toolsUsed: [intent.tool], mode: 'local_operational' };
  const body = Array.isArray(result.data)
    ? rows(result.data)
    : Object.entries(result.data as Record<string, unknown>).map(([key, value]) => `- ${key}: ${value}`).join('\n');
  return { text: `Consulta operativa\n\n${body}\n\nDatos consultados en HAIR STYLE.`, toolsUsed: [intent.tool], mode: 'local_operational' };
}
