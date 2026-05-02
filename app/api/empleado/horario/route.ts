import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../../src/lib/db';

export async function GET(req: NextRequest) {
  try {
    const empleadoIdAuth = req.headers.get('x-user-id');
    
    // Obtener el perfil del empleado
    const perfilEmpleado = await prisma.perfilEmpleado.findUnique({
      where: { userId: empleadoIdAuth! }
    });

    if (!perfilEmpleado) {
      return NextResponse.json({ error: 'Perfil de empleado no encontrado' }, { status: 404 });
    }

    const horarios = await prisma.horario.findMany({
      where: { empleadoId: perfilEmpleado.id },
      orderBy: { diaSemana: 'asc' }
    });

    return NextResponse.json({ horarios }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
