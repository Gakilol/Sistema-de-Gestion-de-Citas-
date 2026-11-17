import type { NextRequest } from 'next/server';
import { getUserContext } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export class AssistantError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export interface AssistantUser { id: string; rol: 'ADMIN' | 'EMPLEADO' | 'TECH_SUPPORT' }

export async function requireAssistantUser(request: NextRequest): Promise<AssistantUser> {
  if (process.env.NOVACITA_IA_ENABLED !== 'true') throw new AssistantError('El asistente no está habilitado en este entorno.', 503);
  const origin = request.headers.get('origin');
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AssistantError('Origen no permitido.', 403);
  }
  const { userId } = getUserContext(request);
  if (!userId) throw new AssistantError('Inicia sesión para usar el asistente.', 401);
  const user = await prisma.empleado.findUnique({ where: { id: userId }, select: { id: true, rol: true, activo: true } });
  if (!user?.activo || !['ADMIN', 'EMPLEADO', 'TECH_SUPPORT'].includes(user.rol)) {
    throw new AssistantError('Tu cuenta no tiene acceso al asistente.', 403);
  }
  return { id: user.id, rol: user.rol };
}

export function scopedEmployee(user: AssistantUser, requested?: string | null) {
  if (user.rol === 'EMPLEADO') {
    if (requested && requested !== user.id) throw new AssistantError('Solo puedes trabajar con tu propia agenda.', 403);
    return user.id;
  }
  return requested || null;
}

export function assistantErrorResponse(error: unknown) {
  const status = error instanceof AssistantError ? error.status : 500;
  return Response.json({ error: error instanceof AssistantError ? error.message : 'No se pudo completar la operación. Intenta de nuevo.' }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
}

export async function readAssistantBody(request: NextRequest) {
  if (Number(request.headers.get('content-length') ?? 0) > 8192) throw new AssistantError('Solicitud demasiado grande.', 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 8192) throw new AssistantError('Solicitud demasiado grande.', 413);
  try { return JSON.parse(text) as unknown; } catch { throw new AssistantError('Solicitud inválida.'); }
}
