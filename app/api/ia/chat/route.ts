import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ChatInputSchema } from '@/lib/ia/domain';
import { requireAssistantUser, readAssistantBody, AssistantError, assistantErrorResponse } from '@/lib/ia/access';
import { chat } from '@/lib/ia/service';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  let stage = 'access';
  try {
    const user = await requireAssistantUser(request);
    stage = 'input';
    const input = ChatInputSchema.safeParse(await readAssistantBody(request));
    if (!input.success) throw new AssistantError('La consulta no es válida o supera 1500 caracteres.');
    stage = 'chat';
    return Response.json(await chat(user, input.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AssistantError) return assistantErrorResponse(error);

    const requestId = randomUUID();
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'UNEXPECTED';
    console.error('NovaCita assistant request failed', { requestId, stage, code });
    const response = assistantErrorResponse(error);
    response.headers.set('X-NovaCita-Request-Id', requestId);
    return response;
  }
}
