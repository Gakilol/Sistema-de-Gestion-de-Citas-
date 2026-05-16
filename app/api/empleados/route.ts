import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../src/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  try {
    const busqueda = req.nextUrl.searchParams.get('q') || '';
    const empleados = await prisma.empleado.findMany({
      where: {
        OR: busqueda ? [
          { nombre: { contains: busqueda, mode: 'insensitive' } },
          { correo: { contains: busqueda, mode: 'insensitive' } },
        ] : undefined,
      },
      select: { id: true, nombre: true, correo: true, telefono: true, especialidad: true, horario: true, rol: true, activo: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ empleados }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden agregar empleados' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, correo, telefono, password, especialidad, horario, rol } = body;

    const existe = await prisma.empleado.findUnique({ where: { correo } });
    if (existe) {
      return NextResponse.json({ error: 'El correo ya está en uso' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password || 'Temporal123!', 10);

    const empleado = await prisma.empleado.create({
      data: {
        nombre,
        correo,
        telefono,
        passwordHash,
        especialidad,
        horario,
        rol: rol || 'EMPLEADO',
      },
      select: { id: true, nombre: true, correo: true, rol: true }
    });

    return NextResponse.json({ empleado, mensaje: 'Empleado creado exitosamente' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
