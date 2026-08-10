import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logLegacyAudit } from '@/lib/audit/legacy-audit';
import { getUserContext } from '@/lib/auth-helpers';
import { buildClientResponse } from '@/lib/client-privacy';
import { validateAndNormalizePhone } from '@/lib/phone';
import { createClientSchema } from '@/lib/validation/client-schemas';

function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

// ─── GET /api/clientes
// Obtiene los clientes de la tabla Cliente e incluye sus métricas basadas en citas.
// Soporta búsqueda por nombre, teléfono y correo electrónico.
// Directorio compartido para todo el personal autenticado.
export async function GET(req: NextRequest) {
  try {
    const { userId, userRole } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const busqueda = normalizarNombre(req.nextUrl.searchParams.get('q') ?? '');
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1);
    const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '24') || 24));

    const searchWhere = busqueda
      ? {
          OR: [
            { nombre: { contains: busqueda, mode: 'insensitive' as const } },
            { telefono: { contains: busqueda, mode: 'insensitive' as const } },
            { cedula: { contains: busqueda, mode: 'insensitive' as const } },
            { correo: { contains: busqueda, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, clientesData] = await Promise.all([
      prisma.cliente.count({ where: searchWhere }),
      prisma.cliente.findMany({
        where: searchWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
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
      }),
    ]);

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
        cedula: c.cedula,
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

    return NextResponse.json({
      clientes,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }, { status: 200 });
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
    const parseResult = createClientSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { nombre, telefono, cedula, correo, notas, confirmarDuplicadoNombre } = parseResult.data;
    const nombreNormalizado = normalizarNombre(nombre);

    if (!nombreNormalizado) {
      return NextResponse.json({ error: 'El nombre es obligatorio (mínimo 2 caracteres)' }, { status: 400 });
    }

    // Normalizar y validar teléfono
    let telefonoNormalizado: string | null = null;
    if (telefono !== undefined && telefono !== null && String(telefono).trim() !== '') {
      const phoneValidation = validateAndNormalizePhone(telefono, '506');
      if (!phoneValidation.isValid) {
        return NextResponse.json(
          { error: phoneValidation.error || 'Número de teléfono inválido' },
          { status: 400 }
        );
      }
      telefonoNormalizado = phoneValidation.normalized;
    }

    const correoNormalizado = correo && String(correo).trim() !== '' ? String(correo).trim().toLowerCase() : null;
    const cedulaNormalizada = cedula && String(cedula).trim() !== '' ? String(cedula).trim() : null;
    const notasNormalizadas = notas && String(notas).trim() !== '' ? String(notas).trim() : null;

    if (!telefonoNormalizado && !confirmarDuplicadoNombre) {
      const posiblesDuplicados = await prisma.cliente.findMany({
        where: { nombre: { equals: nombreNormalizado, mode: 'insensitive' } },
        select: { id: true, nombre: true, telefono: true },
        take: 5,
      });
      if (posiblesDuplicados.length > 0) {
        return NextResponse.json({
          error: 'Ya existe un cliente con el mismo nombre. Confirma si deseas registrarlo de todos modos.',
          requiresConfirmation: true,
          posiblesDuplicados,
        }, { status: 409 });
      }
    }

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
        nombre: nombreNormalizado,
        telefono: telefonoNormalizado,
        cedula: cedulaNormalizada,
        correo: correoNormalizado,
        notas: notasNormalizadas,
        createdByUserId: userId,
      },
    });

    await logLegacyAudit({
      entidad: 'Cliente',
      entidadId: nuevoCliente.id,
      accion: 'CREAR',
      detalles: { nombre: nuevoCliente.nombre, telefono: nuevoCliente.telefono, correo: nuevoCliente.correo },
      realizadoPor: userId,
    });

    return NextResponse.json({ cliente: nuevoCliente, mensaje: 'Cliente registrado exitosamente' }, { status: 201 });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe un cliente registrado con ese número de teléfono o correo electrónico.' },
        { status: 409 }
      );
    }
    console.error('[CLIENT_CREATE_ERROR] Error al crear cliente:', err);
    return NextResponse.json({ error: 'No se pudo crear el cliente. Por favor intente nuevamente.' }, { status: 500 });
  }
}
