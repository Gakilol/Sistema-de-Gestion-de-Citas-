import { NextResponse, NextRequest } from 'next/server';
import { CitaServicio } from '../../../../src/servicios/cita.servicio';

export async function GET(req: NextRequest) {
  try {
    const clienteId = req.headers.get('x-user-id');
    
    if (!clienteId) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const citas = await CitaServicio.obtenerCitasPorCliente(clienteId);
    return NextResponse.json({ citas }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const clienteId = req.headers.get('x-user-id');
    
    if (!clienteId) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const nuevaCita = await CitaServicio.crearCita(clienteId, body);

    return NextResponse.json({ cita: nuevaCita, mensaje: 'Cita creada exitosamente' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
