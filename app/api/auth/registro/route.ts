import { NextResponse } from 'next/server';
import { AuthServicio } from '../../../../src/servicios/auth.servicio';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await AuthServicio.registrar(body);

    return NextResponse.json(
      { mensaje: 'Usuario registrado exitosamente', usuario: result.usuario },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al registrar usuario' },
      { status: 400 }
    );
  }
}
