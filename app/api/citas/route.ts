import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const estado = req.nextUrl.searchParams.get('estado') || '';
    const busqueda = req.nextUrl.searchParams.get('q') || '';

    const citas = await prisma.cita.findMany({
      where: {
        ...(estado && estado !== 'all' ? { estado: estado as any } : {}),
      },
      include: {
        empleado: { select: { nombre: true } },
        servicio: { select: { nombre: true } },
        citaServicios: {
          include: {
            servicio: {
              select: { id: true, nombre: true, duracion: true }
            }
          },
          orderBy: { orden: 'asc' }
        }
      },
      orderBy: [{ fecha: 'desc' }, { hora: 'asc' }],
    });

    const filtradas = busqueda
      ? citas.filter(c =>
          c.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          (c.cliente_telefono && c.cliente_telefono.includes(busqueda)) ||
          c.servicio.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          c.citaServicios.some(cs => cs.servicio.nombre.toLowerCase().includes(busqueda.toLowerCase()))
        )
      : citas;

    return NextResponse.json({ citas: filtradas }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = req.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'Usuario no identificado' }, { status: 401 });
    }

    const { 
      cliente_id, 
      cliente_nombre, 
      cliente_telefono, 
      servicio_id, 
      servicio_ids, // new array of services
      empleado_id, 
      fecha, 
      hora, 
      notas 
    } = body;

    // Resolver IDs de servicios
    const ids = Array.isArray(servicio_ids) && servicio_ids.length > 0 ? servicio_ids : [servicio_id];
    
    // Obtener los detalles de los servicios para sumar duración
    const serviciosDb = await prisma.servicio.findMany({
      where: { id: { in: ids } }
    });

    // Ordenar para respetar la selección
    const serviciosDbOrdenados = ids
      .map(id => serviciosDb.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s);

    if (serviciosDbOrdenados.length === 0) {
      return NextResponse.json({ error: 'No se encontraron los servicios seleccionados' }, { status: 400 });
    }

    const duracionCalculada = serviciosDbOrdenados.reduce((sum, s) => sum + s.duracion, 0);
    const primerServicioId = serviciosDbOrdenados[0].id;

    // VALIDACIÓN DE DISPONIBILIDAD
    const { calcularDisponibilidad } = await import('@/lib/disponibilidad');
    const disponibilidad = await calcularDisponibilidad(empleado_id, fecha.split('T')[0], primerServicioId, duracionCalculada);
    
    if (!disponibilidad.disponible) {
      return NextResponse.json({ error: 'El empleado no está disponible este día: ' + disponibilidad.motivo }, { status: 400 });
    }

    const bloqueSolicitado = disponibilidad.bloques.find((b: any) => b.hora === hora);
    if (!bloqueSolicitado) {
      return NextResponse.json({ error: 'La hora solicitada no está dentro del horario laboral' }, { status: 400 });
    }

    if (!bloqueSolicitado.disponible) {
      return NextResponse.json({ error: 'La hora seleccionada ya no está disponible: ' + bloqueSolicitado.motivo }, { status: 400 });
    }

    // GESTIÓN DE CLIENTE
    let idClienteFinal = cliente_id;
    if (!idClienteFinal && cliente_nombre) {
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

    // Transacción para guardar la cita y sus relaciones
    const cita = await prisma.$transaction(async (tx) => {
      const c = await tx.cita.create({
        data: {
          cliente_id: idClienteFinal,
          cliente_nombre: cliente_nombre.trim(),
          cliente_telefono: cliente_telefono?.trim() || null,
          servicio_id: primerServicioId,
          empleado_id,
          fecha: new Date(fecha),
          hora,
          duracion: duracionCalculada,
          notas,
          created_by: userId,
        },
      });

      const citaServiciosData = serviciosDbOrdenados.map((s, index) => ({
        cita_id: c.id,
        servicio_id: s.id,
        duracion: s.duracion,
        orden: index,
      }));

      await tx.citaServicio.createMany({
        data: citaServiciosData
      });

      return c;
    });

    return NextResponse.json({ cita, mensaje: 'Cita creada exitosamente con sus servicios' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
