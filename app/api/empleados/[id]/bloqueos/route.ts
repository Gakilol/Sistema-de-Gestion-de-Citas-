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
    const bloqueos = await prisma.bloqueoHorario.findMany({
      where: { empleado_id: id }
    });

    // format dates back to YYYY-MM-DD for visual fields
    const formattedBloqueos = bloqueos.map(b => ({
      ...b,
      fecha: b.fecha.toISOString().split('T')[0]
    }));

    return NextResponse.json({ bloqueos: formattedBloqueos }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, userRole } = getUserContext(req);
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden editar horarios y bloqueos' }, { status: 403 });
    }

    const { bloqueos } = await req.json();

    // Re-sync by deleting existing ones and inserting new ones
    await prisma.$transaction([
      prisma.bloqueoHorario.deleteMany({ where: { empleado_id: id } }),
      prisma.bloqueoHorario.createMany({
        data: bloqueos.map((b: any) => ({
          empleado_id: id,
          fecha: parseYYYYMMDD(b.fecha),
          hora_inicio: b.hora_inicio,
          hora_fin: b.hora_fin,
          motivo: b.motivo || '',
        }))
      })
    ]);

    const updatedBloqueos = await prisma.bloqueoHorario.findMany({
      where: { empleado_id: id }
    });

    const formattedBloqueos = updatedBloqueos.map(b => ({
      ...b,
      fecha: b.fecha.toISOString().split('T')[0]
    }));

    return NextResponse.json({ bloqueos: formattedBloqueos, mensaje: 'Bloqueos actualizados exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
