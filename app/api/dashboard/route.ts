import { NextResponse, NextRequest } from 'next/server';
import { AdminServicio } from '@/src/servicios/admin.servicio';
import { getUserContext } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const { userId, userRole } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 401 });
    }

    const periodo = (req.nextUrl.searchParams.get('periodo') as any) || 'mes';
    
    // Si es EMPLEADO, forzar el filtrado por su propio ID de empleado
    const empleadoId = userRole === 'EMPLEADO' ? userId : undefined;
    
    const data = await AdminServicio.getDashboardStats(periodo, empleadoId);
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('[Dashboard API Error]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
