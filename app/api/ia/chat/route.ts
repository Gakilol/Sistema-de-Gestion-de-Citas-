import type { NextRequest } from 'next/server';
import { ChatInputSchema } from '@/lib/ia/domain';
import { requireAssistantUser, readAssistantBody, AssistantError, assistantErrorResponse } from '@/lib/ia/access';
import { chat } from '@/lib/ia/service';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const user = await requireAssistantUser(request);
    const input = ChatInputSchema.safeParse(await readAssistantBody(request));
    if (!input.success) throw new AssistantError('La consulta no es válida o supera 1500 caracteres.');
    return Response.json(await chat(user, input.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantErrorResponse(error); }
}
