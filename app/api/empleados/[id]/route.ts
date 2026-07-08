import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getUserContext } from '@/lib/auth-helpers';

// ─── Schemas Zod ─────────────────────────────────────────────────────────────
const PatchEmpleadoSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  correo: z.string().email().max(254).optional(),
  telefono: z.string().max(30).optional().nullable(),
  password: z.string().min(6).max(128).optional(),
  especialidad: z.string().max(100).optional().nullable(),
  tituloCliente: z.string().max(100).optional().nullable(),
  horario: z.record(z.any()).optional(),
  rol: z.enum(['ADMIN', 'EMPLEADO', 'TECH_SUPPORT']).optional(),
  activo: z.boolean().optional(),
  esAgendable: z.boolean().optional(),
});

// ─── Helper: Verificar que hay al menos otro admin activo ─────────────────────
async function hasOtherActiveAdmin(excludeId: string): Promise<boolean> {
  const count = await prisma.empleado.count({
    where: {
      rol: 'ADMIN',
      activo: true,
      id: { not: excludeId },
    },
  });
  return count > 0;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const empleado = await prisma.empleado.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        especialidad: true,
        tituloCliente: true,
        horario: true,
        rol: true,
        activo: true,
      }
    });

    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ empleado }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, userRole, userEmail } = getUserContext(req);

    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'No tienes permiso para editar empleados' }, { status: 403 });
    }

    const empleadoOriginal = await prisma.empleado.findUnique({
      where: { id },
      select: { id: true, nombre: true, correo: true, rol: true, activo: true }
    });

    if (!empleadoOriginal) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Validar body con Zod (strip: ignorar campos no permitidos)
    const rawBody = await req.json();
    const parseResult = PatchEmpleadoSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parseResult.data;

    // ─── PROTECCIÓN: No permitir degradar o desactivar al último admin ────────
    const isTargetAdmin = empleadoOriginal.rol === 'ADMIN';

    // Caso 1: Intento de desactivar al último admin
    if (isTargetAdmin && body.activo === false) {
      const otherAdminExists = await hasOtherActiveAdmin(id);
      if (!otherAdminExists) {
        return NextResponse.json(
          { error: 'No se puede desactivar al último administrador activo del sistema. Asigne otro administrador primero.' },
          { status: 400 }
        );
      }
    }

    // Caso 2: Intento de cambiar el rol del último admin a algo que no sea ADMIN
    if (isTargetAdmin && body.rol && body.rol !== 'ADMIN') {
      const otherAdminExists = await hasOtherActiveAdmin(id);
      if (!otherAdminExists) {
        return NextResponse.json(
          { error: 'No se puede cambiar el rol del último administrador activo. Asigne otro administrador primero.' },
          { status: 400 }
        );
      }
    }

    // Caso 3: TECH_SUPPORT no puede cambiar roles a ADMIN (solo ADMIN puede hacer eso)
    if (userRole === 'TECH_SUPPORT' && body.rol === 'ADMIN') {
      return NextResponse.json(
        { error: 'El soporte técnico no puede asignar el rol de Administrador.' },
        { status: 403 }
      );
    }

    const dataToUpdate: any = {};
    if (body.nombre) dataToUpdate.nombre = body.nombre;
    if (body.correo) dataToUpdate.correo = body.correo;
    if (body.telefono !== undefined) dataToUpdate.telefono = body.telefono;
    if (body.password) dataToUpdate.passwordHash = await bcrypt.hash(body.password, 10);
    if (body.especialidad !== undefined) dataToUpdate.especialidad = body.especialidad;
    if (body.tituloCliente !== undefined) dataToUpdate.tituloCliente = body.tituloCliente;
    if (body.horario !== undefined) dataToUpdate.horario = body.horario;
    if (body.rol) dataToUpdate.rol = body.rol;
    if (body.activo !== undefined) dataToUpdate.activo = body.activo;
    if (body.esAgendable !== undefined) dataToUpdate.esAgendable = body.esAgendable;

    const empleado = await prisma.empleado.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, nombre: true, correo: true, rol: true, activo: true }
    });

    // Detectar acción
    let finalAction = 'USER_UPDATED';
    let finalDesc = `Usuario ${empleado.nombre} actualizado.`;
    if (body.activo !== undefined && body.activo !== empleadoOriginal.activo) {
      finalAction = body.activo ? 'USER_ACTIVATED' : 'USER_DEACTIVATED';
      finalDesc = body.activo ? `Usuario ${empleado.nombre} activado.` : `Usuario ${empleado.nombre} desactivado.`;
    } else if (body.rol && body.rol !== empleadoOriginal.rol) {
      finalAction = 'ROLE_CHANGED';
      finalDesc = `Rol de usuario ${empleado.nombre} cambiado de ${empleadoOriginal.rol} a ${body.rol}.`;
    } else if (body.password) {
      finalAction = 'PASSWORD_CHANGED';
      finalDesc = `Contraseña del usuario ${empleado.nombre} cambiada por un administrador.`;
    }

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: finalAction,
      module: 'USUARIOS',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail,
      entityType: 'Empleado',
      entityId: id,
      entityName: empleado.nombre,
      description: finalDesc,
      beforeData: empleadoOriginal,
      afterData: empleado,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
    });

    return NextResponse.json({ empleado, mensaje: 'Empleado actualizado exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, userRole, userEmail } = getUserContext(req);

    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'No tienes permiso para eliminar empleados' }, { status: 403 });
    }

    const empleado = await prisma.empleado.findUnique({
      where: { id },
      select: { id: true, nombre: true, correo: true, rol: true }
    });

    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // ─── PROTECCIÓN: No permitir eliminar al último admin activo ──────────────
    if (empleado.rol === 'ADMIN') {
      const otherAdminExists = await hasOtherActiveAdmin(id);
      if (!otherAdminExists) {
        return NextResponse.json(
          { error: 'No se puede eliminar al último administrador del sistema. Asigne otro administrador primero.' },
          { status: 400 }
        );
      }
    }

    // TECH_SUPPORT no puede eliminar usuarios ADMIN
    if (userRole === 'TECH_SUPPORT' && empleado.rol === 'ADMIN') {
      return NextResponse.json(
        { error: 'El soporte técnico no puede eliminar administradores.' },
        { status: 403 }
      );
    }

    // 1. Eliminar citas asociadas (ya sean asignadas al empleado o creadas por él)
    await prisma.cita.deleteMany({
      where: {
        OR: [
          { empleado_id: id },
          { created_by: id }
        ]
      }
    });

    // 2. Eliminar físicamente al empleado (descansos, bloqueos y vacaciones se borran en cascada)
    await prisma.empleado.delete({
      where: { id }
    });

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: 'USER_DELETED',
      module: 'USUARIOS',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail,
      entityType: 'Empleado',
      entityId: id,
      entityName: empleado.nombre,
      description: `Usuario ${empleado.nombre} eliminado permanentemente.`,
      beforeData: empleado,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
    });

    return NextResponse.json({ mensaje: 'Empleado eliminado exitosamente' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
