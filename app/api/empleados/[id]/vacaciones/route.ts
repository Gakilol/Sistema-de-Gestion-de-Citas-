import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';

function parseYYYYMMDD(fechaYYYYMMDD: string): Date {
  const [year, month, day] = fechaYYYYMMDD.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const vacaciones = await prisma.vacacionesEmpleado.findMany({
      where: { empleado_id: id }
    });

    const formattedVacaciones = vacaciones.map((v: any) => ({
      ...v,
      fecha_inicio: v.fecha_inicio.toISOString().split('T')[0],
      fecha_fin: v.fecha_fin.toISOString().split('T')[0]
    }));

    return NextResponse.json({ vacaciones: formattedVacaciones }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, userRole } = getUserContext(req);
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden editar horarios y vacaciones' }, { status: 403 });
    }

    const { vacaciones } = await req.json();

    // Re-sync by deleting existing ones and inserting new ones
    await prisma.$transaction([
      prisma.vacacionesEmpleado.deleteMany({ where: { empleado_id: id } }),
      prisma.vacacionesEmpleado.createMany({
        data: vacaciones.map((v: any) => ({
          empleado_id: id,
          fecha_inicio: parseYYYYMMDD(v.fecha_inicio),
          fecha_fin: parseYYYYMMDD(v.fecha_fin),
          estado: v.estado || 'APROBADO',
        }))
      })
    ]);

    const updatedVacaciones = await prisma.vacacionesEmpleado.findMany({
      where: { empleado_id: id }
    });

    const formattedVacaciones = updatedVacaciones.map((v: any) => ({
      ...v,
      fecha_inicio: v.fecha_inicio.toISOString().split('T')[0],
      fecha_fin: v.fecha_fin.toISOString().split('T')[0]
    }));

    return NextResponse.json({ vacaciones: formattedVacaciones, mensaje: 'Vacaciones actualizadas exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
