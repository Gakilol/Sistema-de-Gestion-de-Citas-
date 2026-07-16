import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { registrarAuditoria } from '@/lib/auditoria';
import { getUserContext } from '@/lib/auth-helpers';

const CreateEmpleadoSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  correo: z.string().email('Correo electrónico no válido').max(254),
  telefono: z.string().max(30).optional().nullable(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(128).optional(),
  especialidad: z.string().max(100).optional().nullable(),
  tituloCliente: z.string().max(100).optional().nullable(),
  horario: z.record(z.any()).optional(),
  rol: z.enum(['ADMIN', 'EMPLEADO', 'TECH_SUPPORT']).optional(),
  esAgendable: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const busqueda = req.nextUrl.searchParams.get('q') || '';
    const schedulable = req.nextUrl.searchParams.get('schedulable') === 'true';

    let whereClause: any = {};
    if (busqueda) {
      whereClause.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' } },
        { correo: { contains: busqueda, mode: 'insensitive' } },
      ];
    }

    if (schedulable) {
      whereClause.activo = true;
      whereClause.esAgendable = true;
      whereClause.rol = { not: 'TECH_SUPPORT' };
    }

    let empleados = await prisma.empleado.findMany({
      where: whereClause,
      select: { id: true, nombre: true, correo: true, telefono: true, especialidad: true, tituloCliente: true, horario: true, rol: true, activo: true, createdAt: true },
      orderBy: { createdAt: 'asc' }, // default asc for chronological order of new users
    });

    if (schedulable) {
      const getPriority = (nombre: string) => {
        const name = nombre.toLowerCase().trim();
        if (name.startsWith('alvaro')) return 1;
        if (name.startsWith('vanessa') || name.startsWith('vannesa')) return 2;
        if (name.startsWith('daniel')) return 3;
        if (name.startsWith('charlie')) return 4;
        return 5;
      };

      empleados = empleados.sort((a, b) => {
        const prioA = getPriority(a.nombre);
        const prioB = getPriority(b.nombre);
        if (prioA !== prioB) return prioA - prioB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    } else {
      // default sorting for general list
      empleados = empleados.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return NextResponse.json({ empleados }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, userRole } = getUserContext(req);
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden agregar empleados' }, { status: 403 });
    }

    const rawBody = await req.json();
    const parseResult = CreateEmpleadoSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { nombre, correo, telefono, password, especialidad, tituloCliente, horario, rol } = parseResult.data;

    // TECH_SUPPORT y ADMIN pueden crear usuarios con cualquier rol

    const existe = await prisma.empleado.findUnique({ where: { correo } });
    if (existe) {
      return NextResponse.json({ error: 'El correo ya está en uso' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password || 'Temporal123!', 10);

    const defaultHorario = {
      lunes: [{ inicio: '08:00', fin: '17:00' }],
      martes: [{ inicio: '08:00', fin: '17:00' }],
      miercoles: [{ inicio: '08:00', fin: '17:00' }],
      jueves: [{ inicio: '08:00', fin: '17:00' }],
      viernes: [{ inicio: '08:00', fin: '17:00' }],
      sabado: [],
      domingo: [],
    };

    const empleado = await prisma.empleado.create({
      data: {
        nombre,
        correo,
        telefono,
        passwordHash,
        especialidad,
        tituloCliente,
        horario: horario || defaultHorario,
        rol: rol || 'EMPLEADO',
      },
      select: { id: true, nombre: true, correo: true, rol: true, tituloCliente: true }
    });

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: 'USER_CREATED',
      module: 'USUARIOS',
      status: 'SUCCESS',
      userId: req.headers.get('x-user-id'),
      userRole: userRole,
      userEmail: req.headers.get('x-user-email'),
      entityType: 'Empleado',
      entityId: empleado.id,
      entityName: empleado.nombre,
      description: `Empleado ${empleado.nombre} creado con rol ${empleado.rol}.`,
      afterData: empleado,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined
    });

    return NextResponse.json({ empleado, mensaje: 'Empleado creado exitosamente' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
