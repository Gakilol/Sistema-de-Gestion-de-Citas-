import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../../src/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { estado, notas, empleado_id, fecha, hora, servicio_id, precio, duracion, cliente_id, cliente_nombre, cliente_telefono, metodo_pago } = body;

    const dataToUpdate: any = {};
    if (estado) dataToUpdate.estado = estado;
    if (notas !== undefined) dataToUpdate.notas = notas;
    if (empleado_id) dataToUpdate.empleado_id = empleado_id;
    if (fecha) dataToUpdate.fecha = new Date(fecha);
    if (hora) dataToUpdate.hora = hora;
    if (servicio_id) dataToUpdate.servicio_id = servicio_id;
    if (precio !== undefined) dataToUpdate.precio = Number(precio);
    if (duracion !== undefined) dataToUpdate.duracion = Number(duracion);
    
    // GESTIÓN DE CLIENTE EN EDICIÓN
    let idClienteFinal = cliente_id;
    if (cliente_nombre && !idClienteFinal) {
      const existe = await prisma.cliente.findFirst({
        where: { 
          nombre: cliente_nombre.trim(),
          ...(cliente_telefono ? { telefono: cliente_telefono.trim() } : {})
        }
      });
      if (existe) {
        idClienteFinal = existe.id;
      } else {
        const nuevoC = await prisma.cliente.create({
          data: {
            nombre: cliente_nombre.trim(),
            telefono: cliente_telefono?.trim() || null,
          }
        });
        idClienteFinal = nuevoC.id;
      }
    }
    
    if (idClienteFinal) dataToUpdate.cliente_id = idClienteFinal;
    if (cliente_nombre) dataToUpdate.cliente_nombre = cliente_nombre.trim();
    if (cliente_telefono !== undefined) dataToUpdate.cliente_telefono = cliente_telefono?.trim() || null;
    
    if (metodo_pago !== undefined) dataToUpdate.metodo_pago = metodo_pago;

    const cita = await prisma.cita.update({
      where: { id },
      data: dataToUpdate,
      include: { servicio: true }
    });

    return NextResponse.json({ cita, mensaje: 'Cita actualizada' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden eliminar citas' }, { status: 403 });
    }

    await prisma.cita.delete({ where: { id } });

    return NextResponse.json({ mensaje: 'Cita eliminada' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
