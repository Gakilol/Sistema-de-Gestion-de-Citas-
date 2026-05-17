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

// ─── POST /api/clientes
// Registra un cliente directamente asociándolo a una cita mínima.
// Requiere: nombre, telefono (opcional). El sistema usa el primer servicio/empleado activo.
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

    // Obtener el primer servicio y empleado activos para la cita
    const [servicio, empleado] = await Promise.all([
      prisma.servicio.findFirst({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
      prisma.empleado.findFirst({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    ]);

    if (!servicio || !empleado) {
      return NextResponse.json({ error: 'Debe existir al menos un servicio y un empleado activos para registrar un cliente' }, { status: 400 });
    }

    // Obtener userId del header si existe
    const userId = req.headers.get('x-user-id') ?? empleado.id;

    // Crear cita mínima con estado PENDIENTE y fecha hoy
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);

    const cita = await prisma.cita.create({
      data: {
        cliente_nombre:   nombre.trim(),
        cliente_telefono: telefono?.trim() || null,
        servicio_id:      servicio.id,
        empleado_id:      empleado.id,
        fecha:            hoy,
        hora:             '09:00',
        duracion:         servicio.duracion,
        precio:           servicio.precio,
        estado:           'PENDIENTE',
        created_by:       userId,
        notas:            'Cliente registrado manualmente',
      },
    });

    return NextResponse.json({ cita, mensaje: 'Cliente registrado exitosamente' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
