import type { NextRequest } from 'next/server';
import { requireAssistantUser, assistantErrorResponse } from '@/lib/ia/access';
import { assistantCatalog } from '@/lib/ia/service';
import { BUSINESS_TIMEZONE } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAssistantUser(request);
    return Response.json({ ...await assistantCatalog(user), zonaHoraria: BUSINESS_TIMEZONE, baseCompartida: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantErrorResponse(error); }
}
