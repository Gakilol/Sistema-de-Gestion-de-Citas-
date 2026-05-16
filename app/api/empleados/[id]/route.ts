import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../../src/lib/db';
import bcrypt from 'bcryptjs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden editar empleados' }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, correo, telefono, password, especialidad, horario, rol, activo } = body;

    const dataToUpdate: any = {};
    if (nombre) dataToUpdate.nombre = nombre;
    if (correo) dataToUpdate.correo = correo;
    if (telefono !== undefined) dataToUpdate.telefono = telefono;
    if (password) dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
    if (especialidad !== undefined) dataToUpdate.especialidad = especialidad;
    if (horario !== undefined) dataToUpdate.horario = horario;
    if (rol) dataToUpdate.rol = rol;
    if (activo !== undefined) dataToUpdate.activo = activo;

    const empleado = await prisma.empleado.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, nombre: true, correo: true, rol: true, activo: true }
    });

    return NextResponse.json({ empleado, mensaje: 'Empleado actualizado exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden desactivar empleados' }, { status: 403 });
    }

    await prisma.empleado.update({
      where: { id },
      data: { activo: false }
    });

    return NextResponse.json({ mensaje: 'Empleado desactivado' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
