import { NextResponse, NextRequest } from 'next/server';
import { AdminServicio } from '../../../src/servicios/admin.servicio';

export async function GET(req: NextRequest) {
  try {
    const periodo = (req.nextUrl.searchParams.get('periodo') as any) || 'mes';
    const data = await AdminServicio.getDashboardStats(periodo);
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
