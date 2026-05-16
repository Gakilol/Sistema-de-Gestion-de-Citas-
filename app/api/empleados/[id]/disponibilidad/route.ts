import { NextResponse, NextRequest } from 'next/server';
import { calcularDisponibilidad } from '../../../../../src/lib/disponibilidad';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const fechaParam = searchParams.get('fecha'); // YYYY-MM-DD
    const servicioId = searchParams.get('servicio_id');

    if (!fechaParam) {
      return NextResponse.json({ error: 'Falta el parámetro fecha' }, { status: 400 });
    }

    const resultado = await calcularDisponibilidad(id, fechaParam, servicioId);

    return NextResponse.json(resultado, { status: 200 });
  } catch (error: any) {
    console.error('Error calculando disponibilidad:', error);
    return NextResponse.json({ error: error.message }, { status: error.message === 'Empleado no encontrado' ? 404 : 500 });
  }
}
