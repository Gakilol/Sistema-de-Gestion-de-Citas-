import type { NextRequest } from 'next/server';
import { ConfirmInputSchema } from '@/lib/ia/domain';
import { requireAssistantUser, readAssistantBody, AssistantError, assistantErrorResponse } from '@/lib/ia/access';
import { confirmDraft } from '@/lib/ia/service';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const user = await requireAssistantUser(request);
    const input = ConfirmInputSchema.safeParse(await readAssistantBody(request));
    if (!input.success) throw new AssistantError('Confirmación inválida.');
    const result = await confirmDraft(user, input.data.borradorId, input.data.revision);
    return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantErrorResponse(error); }
}
