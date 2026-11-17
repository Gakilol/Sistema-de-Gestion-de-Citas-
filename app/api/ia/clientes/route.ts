import type { NextRequest } from 'next/server';
import { requireAssistantUser, AssistantError, assistantErrorResponse } from '@/lib/ia/access';
import { searchClientDirectory } from '@/lib/clients/client-search';
import { buildClientDirectoryResponse } from '@/lib/client-privacy';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAssistantUser(request);
    const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (query.length > 100) throw new AssistantError('La búsqueda es demasiado larga.');
    if (query.length < 2) return Response.json({ clientes: [] }, { headers: { 'Cache-Control': 'no-store' } });
    const clients = await searchClientDirectory(query, { limit: 8 });
    const clientes = clients.map(client => {
      const safe = buildClientDirectoryResponse(client, user.rol);
      return { id: safe.id, nombre: safe.nombre, telefono: safe.telefono };
    });
    return Response.json({ clientes }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantErrorResponse(error); }
}
