import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const descansos = await prisma.descansoEmpleado.findMany({
      where: { empleado_id: id }
    });
    return NextResponse.json({ descansos }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden editar horarios y descansos' }, { status: 403 });
    }

    const { descansos } = await req.json();

    // Re-sync by deleting existing ones and inserting new ones
    await prisma.$transaction([
      prisma.descansoEmpleado.deleteMany({ where: { empleado_id: id } }),
      prisma.descansoEmpleado.createMany({
        data: descansos.map((d: any) => ({
          empleado_id: id,
          dia_semana: Number(d.dia_semana),
          hora_inicio: d.hora_inicio,
          hora_fin: d.hora_fin,
        }))
      })
    ]);

    const updatedDescansos = await prisma.descansoEmpleado.findMany({
      where: { empleado_id: id }
    });

    return NextResponse.json({ descansos: updatedDescansos, mensaje: 'Descansos actualizados exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
