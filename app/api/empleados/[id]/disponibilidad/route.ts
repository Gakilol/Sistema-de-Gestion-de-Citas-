import { NextResponse, NextRequest } from 'next/server';
import { calculateAppointmentAvailability } from '@/lib/appointments/appointment-availability';
import { getUserContext } from '@/lib/auth-helpers';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, userRole } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

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

    const permitirHorarioExtendido = userRole === 'ADMIN' || userRole === 'EMPLEADO' || userRole === 'TECH_SUPPORT';

    const resultado = await calculateAppointmentAvailability(
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
    const msg = error.message === 'Empleado no encontrado' ? 'Empleado no encontrado' : 'Error al calcular la disponibilidad';
    const status = error.message === 'Empleado no encontrado' ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
