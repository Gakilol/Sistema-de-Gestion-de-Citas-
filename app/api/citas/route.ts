import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { syncCitaEstados } from '@/lib/automatizacion';
import { parseLocalDateToUTC } from '@/lib/timezone';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  try {
    await syncCitaEstados();

    const estado   = req.nextUrl.searchParams.get('estado') || '';
    const busqueda = req.nextUrl.searchParams.get('q') || '';

    const citas = await prisma.cita.findMany({
      where: {
        ...(estado && estado !== 'all' ? { estado: estado as any } : {}),
      },
      include: {
        empleado: { select: { nombre: true } },
        servicio: {
          select: {
            nombre: true,
            categoriaRel: { select: { nombre: true, color: true } }
          }
        },
        citaServicios: {
          include: {
            servicio: {
              select: {
                id: true,
                nombre: true,
                duracion: true,
                categoriaRel: { select: { nombre: true, color: true } }
              }
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
    const body     = await req.json();
    const userId   = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role') || '';

    if (!userId) {
      return NextResponse.json({ error: 'Usuario no identificado' }, { status: 401 });
    }

    // TECH_SUPPORT no puede crear citas
    if (userRole === 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'El rol Soporte Técnico no puede crear citas' }, { status: 403 });
    }

    const {
      cliente_id,
      cliente_nombre,
      cliente_telefono,
      servicio_id,
      servicio_ids,
      servicios_seleccionados,
      empleado_id,
      fecha,
      hora,
      notas,
      forzar,   // ← flag para forzar agendamiento (solo ADMIN)
    } = body;

    // Resolver servicios
    let serviciosParaCita: { id: string; duracion: number }[] = [];
    if (Array.isArray(servicios_seleccionados) && servicios_seleccionados.length > 0) {
      const ids = servicios_seleccionados.map((s: any) => s.id);
      const serviciosDb = await prisma.servicio.findMany({ where: { id: { in: ids } } });
      if (serviciosDb.length === 0) {
        return NextResponse.json({ error: 'No se encontraron los servicios seleccionados' }, { status: 400 });
      }
      serviciosParaCita = servicios_seleccionados.map((sel: any) => {
        const sDb = serviciosDb.find(s => s.id === sel.id);
        return {
          id: sel.id,
          duracion: typeof sel.duracion === 'number' && sel.duracion > 0 ? sel.duracion : (sDb?.duracion || 30)
        };
      }).filter((s: any) => s.id);
    } else {
      const ids = Array.isArray(servicio_ids) && servicio_ids.length > 0 ? servicio_ids : [servicio_id];
      const serviciosDb = await prisma.servicio.findMany({ where: { id: { in: ids } } });
      const serviciosDbOrdenados = ids
        .map((id: string) => serviciosDb.find(s => s.id === id))
        .filter((s: any): s is NonNullable<typeof s> => !!s);

      if (serviciosDbOrdenados.length === 0) {
        return NextResponse.json({ error: 'No se encontraron los servicios seleccionados' }, { status: 400 });
      }
      serviciosParaCita = serviciosDbOrdenados.map((s: any) => ({ id: s.id, duracion: s.duracion }));
    }

    const duracionCalculada = serviciosParaCita.reduce((sum, s) => sum + s.duracion, 0);
    const primerServicioId  = serviciosParaCita[0].id;

    // ─── VALIDACIÓN DE DISPONIBILIDAD ───────────────────────────────────────
    // Si el admin manda forzar: true, se omite la validación de colisiones
    const esForzado = forzar === true && userRole === 'ADMIN';
    const permitirHorarioExtendido = userRole === 'ADMIN' || userRole === 'EMPLEADO';

    const { calcularDisponibilidad, validarHoraExacta } = await import('@/lib/disponibilidad');
    const disponibilidad = await calcularDisponibilidad(
      empleado_id,
      fecha.split('T')[0],
      primerServicioId,
      duracionCalculada,
      hora,
      null,
      permitirHorarioExtendido
    );

    if (!disponibilidad.disponible) {
      return NextResponse.json({ error: 'El empleado no está disponible este día: ' + disponibilidad.motivo }, { status: 400 });
    }

    if (!disponibilidad.jornada) {
      return NextResponse.json({ error: 'No se pudo determinar la jornada laboral' }, { status: 400 });
    }

    if (!esForzado) {
      // Solo validar colisiones si NO se está forzando
      const validacion = validarHoraExacta(
        hora,
        duracionCalculada,
        disponibilidad.jornada.inicio,
        disponibilidad.jornada.fin,
        disponibilidad.intervalosOcupados,
        permitirHorarioExtendido,
        disponibilidad.turnosEmpleado
      );

      if (!validacion.valida) {
        return NextResponse.json({ error: 'Hora no disponible: ' + validacion.motivo }, { status: 400 });
      }
    }

    // ─── GESTIÓN DE CLIENTE ─────────────────────────────────────────────────
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
            nombre:   cliente_nombre.trim(),
            telefono: cliente_telefono?.trim() || null,
          }
        });
        idClienteFinal = nuevoC.id;
      }
    }

    // ─── TRANSACCIÓN: Guardar cita + relaciones ──────────────────────────────
    const cita = await prisma.$transaction(async (tx) => {
      const c = await tx.cita.create({
        data: {
          cliente_id:       idClienteFinal,
          cliente_nombre:   cliente_nombre.trim(),
          cliente_telefono: cliente_telefono?.trim() || null,
          servicio_id:      primerServicioId,
          empleado_id,
          fecha:            parseLocalDateToUTC(fecha.split('T')[0]),
          hora,
          duracion:         duracionCalculada,
          notas,
          created_by:       userId,
        },
      });

      await tx.citaServicio.createMany({
        data: serviciosParaCita.map((s, index) => ({
          cita_id:     c.id,
          servicio_id: s.id,
          duracion:    s.duracion,
          orden:       index,
        }))
      });

      return c;
    });

    await registrarAuditoria({
      entidad: 'Cita',
      entidadId: cita.id,
      accion: esForzado ? 'FORZAR' : 'CREAR',
      detalles: {
        cliente: cliente_nombre,
        empleado_id,
        fecha,
        hora,
        duracion: duracionCalculada,
        servicios: serviciosParaCita.map(s => s.id),
        forzado: esForzado,
      },
      realizadoPor: userId,
    });

    return NextResponse.json({ cita, mensaje: 'Cita creada exitosamente con sus servicios' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
