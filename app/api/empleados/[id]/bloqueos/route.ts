import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { isValidBlockInput } from '@/lib/appointments/schedule-input';
import { parseLocalDateToUTC } from '@/lib/timezone';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, userRole } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const bloqueos = await prisma.bloqueoHorario.findMany({
      where: { empleado_id: id }
    });

    // format dates back to YYYY-MM-DD for visual fields
    const formattedBloqueos = bloqueos.map((b: any) => ({
      ...b,
      fecha: b.fecha.toISOString().split('T')[0]
    }));

    return NextResponse.json({ bloqueos: formattedBloqueos }, { status: 200 });
  } catch (error: any) {
    console.error('[BLOQUEOS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Error al consultar bloqueos' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userRole } = getUserContext(req);
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden editar horarios y bloqueos' }, { status: 403 });
    }

    const { bloqueos } = await req.json();
    if (!isValidBlockInput(bloqueos)) {
      return NextResponse.json({ error: 'Revise la fecha y las horas de los bloqueos' }, { status: 400 });
    }

    // Re-sync by deleting existing ones and inserting new ones
    await prisma.$transaction([
      prisma.bloqueoHorario.deleteMany({ where: { empleado_id: id } }),
      prisma.bloqueoHorario.createMany({
        data: bloqueos.map((b: any) => ({
          empleado_id: id,
          fecha: parseLocalDateToUTC(b.fecha),
          hora_inicio: b.hora_inicio,
          hora_fin: b.hora_fin,
          motivo: b.motivo || '',
        }))
      })
    ]);

    const updatedBloqueos = await prisma.bloqueoHorario.findMany({
      where: { empleado_id: id }
    });

    const formattedBloqueos = updatedBloqueos.map((b: any) => ({
      ...b,
      fecha: b.fecha.toISOString().split('T')[0]
    }));

    return NextResponse.json({ bloqueos: formattedBloqueos, mensaje: 'Bloqueos actualizados exitosamente' }, { status: 200 });
  } catch (error: any) {
    console.error('[BLOQUEOS_PUT_ERROR]', error);
    return NextResponse.json({ error: 'Error al actualizar bloqueos' }, { status: 500 });
  }
}
