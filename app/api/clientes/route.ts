import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../src/lib/db';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../src/lib/db';

// ─── GET /api/clientes
// Obtiene los clientes de la tabla Cliente e incluye sus métricas basadas en citas
export async function GET(req: NextRequest) {
  try {
    const busqueda = req.nextUrl.searchParams.get('q') ?? '';

    // Buscar clientes en la base de datos
    let whereClause = {};
    if (busqueda) {
      whereClause = {
        OR: [
          { nombre: { contains: busqueda, mode: 'insensitive' } },
          { telefono: { contains: busqueda, mode: 'insensitive' } },
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
            precio: true,
            estado: true,
            servicio: { select: { nombre: true } },
            empleado: { select: { nombre: true } },
          },
          orderBy: { fecha: 'desc' },
        },
      },
    });

    // Mapear y calcular métricas para cada cliente
    const clientes = clientesData.map((c) => {
      let citasCompletadas = 0;
      let gastoTotal = 0;
      let ultimaCita = c.createdAt;
      let primeraCita = c.createdAt;
      const serviciosFrecuentes: Record<string, number> = {};

      if (c.citas.length > 0) {
        primeraCita = c.citas[c.citas.length - 1].fecha; // la más antigua, ya que están ordenadas desc
        ultimaCita = c.citas[0].fecha; // la más reciente
      }

      for (const cita of c.citas) {
        if (cita.estado === 'COMPLETADA') {
          citasCompletadas++;
          gastoTotal += cita.precio;
        }
        if (cita.fecha > ultimaCita) ultimaCita = cita.fecha;
        if (cita.fecha < primeraCita) primeraCita = cita.fecha;
        
        const sn = cita.servicio?.nombre;
        if (sn) {
          serviciosFrecuentes[sn] = (serviciosFrecuentes[sn] ?? 0) + 1;
        }
      }

      const servicioFavorito = Object.entries(serviciosFrecuentes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return {
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        totalCitas: c.citas.length,
        citasCompletadas,
        gastoTotal,
        ultimaCita,
        primeraCita,
        esRecurrente: c.citas.length > 1,
        servicioFavorito,
        historial: c.citas.slice(0, 10),
      };
    });

    // Ordenar: más citas primero
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
    if (!userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { nombre, telefono } = body;

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json({ error: 'El nombre es obligatorio (mínimo 2 caracteres)' }, { status: 400 });
    }

    const nuevoCliente = await prisma.cliente.create({
      data: {
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
      },
    });

    return NextResponse.json({ cliente: nuevoCliente, mensaje: 'Cliente registrado exitosamente' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
