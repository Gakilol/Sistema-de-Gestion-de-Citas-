import { NextResponse, NextRequest } from 'next/server';
import { calcularDisponibilidad } from '@/lib/disponibilidad';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const fechaParam = searchParams.get('fecha'); // YYYY-MM-DD
    const servicioId = searchParams.get('servicio_id');
    const duracionTotalParam = searchParams.get('duracion_total');
    const duracionTotal = duracionTotalParam ? Number(duracionTotalParam) : null;
    const horaRequerida = searchParams.get('hora_requerida');
    const excludeCitaId = searchParams.get('exclude_cita_id');

        if (!fechaParam) {
      return NextResponse.json({ error: 'Falta el parámetro fecha' }, { status: 400 });
    }

    const userRole = req.headers.get('x-user-role');
    const permitirHorarioExtendido = userRole === 'ADMIN' || userRole === 'EMPLEADO';

    const resultado = await calcularDisponibilidad(
      id, 
      fechaParam, 
      servicioId, 
      duracionTotal, 
      horaRequerida, 
      excludeCitaId,
      permitirHorarioExtendido
    );

    return NextResponse.json(resultado, { status: 200 });
  } catch (error: any) {
    console.error('Error calculando disponibilidad:', error);
    return NextResponse.json({ error: error.message }, { status: error.message === 'Empleado no encontrado' ? 404 : 500 });
  }
}
