import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../src/lib/db';

// ─── GET /api/clientes
// Agrupa citas por (cliente_nombre, cliente_telefono) y calcula métricas
export async function GET(req: NextRequest) {
  try {
    const busqueda = req.nextUrl.searchParams.get('q') ?? '';

    const citas = await prisma.cita.findMany({
      select: {
        id: true,
        cliente_nombre: true,
        cliente_telefono: true,
        servicio_id: true,
        empleado_id: true,
        fecha: true,
        hora: true,
        precio: true,
        estado: true,
        created_at: true,
        servicio: { select: { nombre: true } },
        empleado: { select: { nombre: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    // Agrupar por clave única: nombre normalizado + teléfono
    const mapa = new Map<
      string,
      {
        id: string;
        nombre: string;
        telefono: string | null;
        totalCitas: number;
        citasCompletadas: number;
        gastoTotal: number;
        ultimaCita: Date;
        primeraCita: Date;
        serviciosFrecuentes: Record<string, number>;
        historial: typeof citas;
      }
    >();

    for (const c of citas) {
      const clave =
        c.cliente_nombre.trim().toLowerCase() +
        '|' +
        (c.cliente_telefono?.replace(/\D/g, '') ?? '');

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          id: c.id,
          nombre: c.cliente_nombre.trim(),
          telefono: c.cliente_telefono ?? null,
          totalCitas: 0,
          citasCompletadas: 0,
          gastoTotal: 0,
          ultimaCita: c.fecha,
          primeraCita: c.fecha,
          serviciosFrecuentes: {},
          historial: [],
        });
      }

      const entry = mapa.get(clave)!;
      entry.totalCitas++;
      if (c.estado === 'COMPLETADA') {
        entry.citasCompletadas++;
        entry.gastoTotal += c.precio;
      }
      if (c.fecha > entry.ultimaCita) entry.ultimaCita = c.fecha;
      if (c.fecha < entry.primeraCita) entry.primeraCita = c.fecha;
      const sn = c.servicio.nombre;
      entry.serviciosFrecuentes[sn] = (entry.serviciosFrecuentes[sn] ?? 0) + 1;
      entry.historial.push(c);
    }

    // Convertir a array y calcular servicioFavorito
    let clientes = Array.from(mapa.values()).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      totalCitas: c.totalCitas,
      citasCompletadas: c.citasCompletadas,
      gastoTotal: c.gastoTotal,
      ultimaCita: c.ultimaCita,
      primeraCita: c.primeraCita,
      esRecurrente: c.totalCitas > 1,
      servicioFavorito:
        Object.entries(c.serviciosFrecuentes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      historial: c.historial.slice(0, 10),
    }));

    // Filtro de búsqueda
    if (busqueda) {
      const q = busqueda.toLowerCase();
      clientes = clientes.filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.telefono && c.telefono.includes(busqueda))
      );
    }

    // Ordenar: más citas primero
    clientes.sort((a, b) => b.totalCitas - a.totalCitas);

    return NextResponse.json({ clientes, total: clientes.length }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
