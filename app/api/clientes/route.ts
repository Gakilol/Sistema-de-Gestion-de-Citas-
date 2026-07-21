import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { registrarAuditoria } from '@/lib/auditoria';
import { getUserContext } from '@/lib/auth-helpers';
import { buildClientResponse } from '@/lib/client-privacy';
import { validarYNormalizarTelefono } from '@/lib/normalize-phone';

const CreateClienteSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio (mínimo 2 caracteres)').max(150).trim(),
  telefono: z.string().max(30).trim().optional().nullable(),
  correo: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().email('Correo inválido').max(254).trim().optional().nullable()
  ),
  notas: z.string().max(1000).trim().optional().nullable(),
});

// ─── GET /api/clientes
// Obtiene los clientes de la tabla Cliente e incluye sus métricas basadas en citas.
// Soporta búsqueda por nombre, teléfono y correo electrónico.
export async function GET(req: NextRequest) {
  try {
    const { userId, userRole } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const busqueda = req.nextUrl.searchParams.get('q') ?? '';

    const searchWhere = busqueda
      ? {
          OR: [
            { nombre: { contains: busqueda, mode: 'insensitive' as const } },
            { telefono: { contains: busqueda, mode: 'insensitive' as const } },
            { correo: { contains: busqueda, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const employeeAccessWhere = {
      OR: [
        { createdByUserId: userId },
        { citas: { some: { empleado_id: userId } } },
      ],
    };
    const whereClause = userRole === 'EMPLEADO'
      ? { AND: [employeeAccessWhere, searchWhere] }
      : searchWhere;

    const clientesData = await prisma.cliente.findMany({
      where: whereClause,
      include: {
        citas: {
          ...(userRole === 'EMPLEADO' ? { where: { empleado_id: userId } } : {}),
          select: {
            id: true,
            fecha: true,
            hora: true,
            estado: true,
            empleado_id: true,
            servicio: { select: { nombre: true } },
            empleado: { select: { nombre: true } },
          },
          orderBy: { fecha: 'desc' },
        },
      },
    });

    const clientes = clientesData.map((c: any) => {
      let citasCompletadas = 0;
      let ultimaCita = c.createdAt;
      let primeraCita = c.createdAt;
      const serviciosFrecuentes: Record<string, number> = {};

      if (c.citas.length > 0) {
        primeraCita = c.citas[c.citas.length - 1].fecha;
        ultimaCita  = c.citas[0].fecha;
      }

      for (const cita of c.citas) {
        if (cita.estado === 'COMPLETADA') citasCompletadas++;
        if (cita.fecha > ultimaCita) ultimaCita = cita.fecha;
        if (cita.fecha < primeraCita) primeraCita = cita.fecha;

        const sn = cita.servicio?.nombre;
        if (sn) serviciosFrecuentes[sn] = (serviciosFrecuentes[sn] ?? 0) + 1;
      }

      const servicioFavorito =
        Object.entries(serviciosFrecuentes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const rawCliente = {
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        correo: c.correo,
        notas: c.notas,
        createdByUserId: c.createdByUserId,
        citas: c.citas,
        totalCitas: c.citas.length,
        citasCompletadas,
        ultimaCita,
        primeraCita,
        esRecurrente: c.citas.length > 1,
        servicioFavorito,
        historial: c.citas.slice(0, 10),
      };

      return buildClientResponse(rawCliente, userRole);
    });

    clientes.sort((a: any, b: any) => b.totalCitas - a.totalCitas);

    return NextResponse.json({ clientes, total: clientes.length }, { status: 200 });
  } catch (err: any) {
    console.error('[CLIENTS_GET_ERROR] Error al obtener clientes:', err);
    return NextResponse.json({ error: 'Error al consultar la lista de clientes' }, { status: 500 });
  }
}

// ─── POST /api/clientes
// Registra un cliente de forma independiente en la tabla Cliente.
export async function POST(req: NextRequest) {
  try {
    const { userId, userRole } = getUserContext(req);

    if (!userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rawBody = await req.json();
    const parseResult = CreateClienteSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { nombre, telefono, correo, notas } = parseResult.data;

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json({ error: 'El nombre es obligatorio (mínimo 2 caracteres)' }, { status: 400 });
    }

    // Normalizar y validar teléfono
    let telefonoNormalizado: string | null = null;
    if (telefono !== undefined && telefono !== null && String(telefono).trim() !== '') {
      const phoneValidation = validarYNormalizarTelefono(telefono, '506');
      if (!phoneValidation.isValid) {
        return NextResponse.json(
          { error: phoneValidation.error || 'Número de teléfono inválido' },
          { status: 400 }
        );
      }
      telefonoNormalizado = phoneValidation.normalized;
    }

    const correoNormalizado = correo && String(correo).trim() !== '' ? String(correo).trim().toLowerCase() : null;
    const notasNormalizadas = notas && String(notas).trim() !== '' ? String(notas).trim() : null;

    // Validar teléfono duplicado (solo si se provee uno)
    if (telefonoNormalizado) {
      const duplicadoTel = await prisma.cliente.findFirst({
        where: { telefono: telefonoNormalizado },
      });
      if (duplicadoTel) {
        const errorMsg = userRole === 'EMPLEADO'
          ? 'Ya existe un cliente con estos datos. Contacte a un administrador para verificar la información.'
          : `Ya existe un cliente con el teléfono ${telefonoNormalizado} (${duplicadoTel.nombre})`;
        return NextResponse.json({ error: errorMsg }, { status: 409 });
      }
    }

    // Validar correo duplicado (solo si se provee uno)
    if (correoNormalizado) {
      const duplicadoEmail = await prisma.cliente.findFirst({
        where: { correo: correoNormalizado },
      });
      if (duplicadoEmail) {
        const errorMsg = userRole === 'EMPLEADO'
          ? 'Ya existe un cliente con estos datos. Contacte a un administrador para verificar la información.'
          : `Ya existe un cliente con ese correo electrónico (${duplicadoEmail.nombre})`;
        return NextResponse.json({ error: errorMsg }, { status: 409 });
      }
    }

    const nuevoCliente = await prisma.cliente.create({
      data: {
        nombre: nombre.trim(),
        telefono: telefonoNormalizado,
        correo: correoNormalizado,
        notas: notasNormalizadas,
        createdByUserId: userId,
      },
    });

    await registrarAuditoria({
      entidad: 'Cliente',
      entidadId: nuevoCliente.id,
      accion: 'CREAR',
      detalles: { nombre: nuevoCliente.nombre, telefono: nuevoCliente.telefono, correo: nuevoCliente.correo },
      realizadoPor: userId,
    });

    return NextResponse.json({ cliente: nuevoCliente, mensaje: 'Cliente registrado exitosamente' }, { status: 201 });
  } catch (err: any) {
    console.error('[CLIENT_CREATE_ERROR] Error al crear cliente:', err);
    return NextResponse.json({ error: 'No se pudo crear el cliente. Por favor intente nuevamente.' }, { status: 500 });
  }
}

