import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../src/lib/db';

export async function GET(req: NextRequest) {
  try {
    const estado = req.nextUrl.searchParams.get('estado') || '';
    const busqueda = req.nextUrl.searchParams.get('q') || '';

    const citas = await prisma.cita.findMany({
      where: {
        ...(estado && estado !== 'all' ? { estado: estado as any } : {}),
      },
      include: {
        empleado: { select: { nombre: true } },
        servicio: { select: { nombre: true } },
      },
      orderBy: [{ fecha: 'desc' }, { hora: 'asc' }],
    });

    const filtradas = busqueda
      ? citas.filter(c =>
          c.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          (c.cliente_telefono && c.cliente_telefono.includes(busqueda)) ||
          c.servicio.nombre.toLowerCase().includes(busqueda.toLowerCase())
        )
      : citas;

    return NextResponse.json({ citas: filtradas }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = req.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'Usuario no identificado' }, { status: 401 });
    }

    const { cliente_nombre, cliente_telefono, servicio_id, empleado_id, fecha, hora, duracion, precio, notas, metodo_pago } = body;

    // VALIDACIÓN DE DISPONIBILIDAD
    const { calcularDisponibilidad } = await import('../../../src/lib/disponibilidad');
    const disponibilidad = await calcularDisponibilidad(empleado_id, fecha.split('T')[0], servicio_id);
    
    if (!disponibilidad.disponible) {
      return NextResponse.json({ error: 'El empleado no está disponible este día: ' + disponibilidad.motivo }, { status: 400 });
    }

    const bloqueSolicitado = disponibilidad.bloques.find((b: any) => b.hora === hora);
    if (!bloqueSolicitado) {
      return NextResponse.json({ error: 'La hora solicitada no está dentro del horario laboral' }, { status: 400 });
    }

    if (!bloqueSolicitado.disponible) {
      return NextResponse.json({ error: 'La hora seleccionada ya no está disponible: ' + bloqueSolicitado.motivo }, { status: 400 });
    }

    const cita = await prisma.cita.create({
      data: {
        cliente_nombre,
        cliente_telefono,
        servicio_id,
        empleado_id,
        fecha: new Date(fecha),
        hora,
        duracion: Number(duracion),
        precio: Number(precio),
        notas,
        metodo_pago,
        created_by: userId,
      },
    });

    return NextResponse.json({ cita, mensaje: 'Cita creada exitosamente' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
