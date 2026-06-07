import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

// ─── GET /api/clientes
// Obtiene los clientes de la tabla Cliente e incluye sus métricas basadas en citas.
// Soporta búsqueda por nombre, teléfono y correo electrónico.
export async function GET(req: NextRequest) {
  try {
    const busqueda = req.nextUrl.searchParams.get('q') ?? '';

    let whereClause = {};
    if (busqueda) {
      whereClause = {
        OR: [
          { nombre:  { contains: busqueda, mode: 'insensitive' } },
          { telefono: { contains: busqueda, mode: 'insensitive' } },
          { correo:  { contains: busqueda, mode: 'insensitive' } },
        ],
      };
    }

    const clientesData = await prisma.cliente.findMany({
      where: whereClause,
      include: {
        citas: {
          select: {
            id: true,
            fecha: true,
            hora: true,
            estado: true,
            servicio: { select: { nombre: true } },
            empleado: { select: { nombre: true } },
          },
          orderBy: { fecha: 'desc' },
        },
      },
    });

    const clientes = clientesData.map((c) => {
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

      return {
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        correo: c.correo,
        notas: c.notas,
        totalCitas: c.citas.length,
        citasCompletadas,
        ultimaCita,
        primeraCita,
        esRecurrente: c.citas.length > 1,
        servicioFavorito,
        historial: c.citas.slice(0, 10),
      };
    });

    clientes.sort((a, b) => b.totalCitas - a.totalCitas);

    return NextResponse.json({ clientes, total: clientes.length }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST /api/clientes
// Registra un cliente de forma independiente en la tabla Cliente.
export async function POST(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    const userId   = req.headers.get('x-user-id');

    if (!userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }



    const body = await req.json();
    const { nombre, telefono, correo, notas } = body;

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json({ error: 'El nombre es obligatorio (mínimo 2 caracteres)' }, { status: 400 });
    }

    // Validar teléfono duplicado (solo si se provee uno)
    if (telefono && telefono.trim()) {
      const duplicadoTel = await prisma.cliente.findFirst({
        where: { telefono: telefono.trim() },
      });
      if (duplicadoTel) {
        return NextResponse.json(
          { error: `Ya existe un cliente con el teléfono ${telefono.trim()} (${duplicadoTel.nombre})` },
          { status: 409 }
        );
      }
    }

    // Validar correo duplicado (solo si se provee uno)
    if (correo && correo.trim()) {
      const duplicadoEmail = await prisma.cliente.findFirst({
        where: { correo: correo.trim().toLowerCase() },
      });
      if (duplicadoEmail) {
        return NextResponse.json(
          { error: `Ya existe un cliente con ese correo electrónico (${duplicadoEmail.nombre})` },
          { status: 409 }
        );
      }
    }

    const nuevoCliente = await prisma.cliente.create({
      data: {
        nombre:  nombre.trim(),
        telefono: telefono?.trim() || null,
        correo:   correo?.trim().toLowerCase() || null,
        notas:   notas?.trim() || null,
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
