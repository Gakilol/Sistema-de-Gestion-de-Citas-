import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { syncCitaEstados } from '@/lib/automatizacion';
import { parseLocalDateToUTC } from '@/lib/timezone';
import { registrarAuditoria } from '@/lib/auditoria';
import { getUserContext, getScopedAppointmentWhere } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    await syncCitaEstados();

    const { userId, userRole } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 401 });
    }

    const estado   = req.nextUrl.searchParams.get('estado') || '';
    const busqueda = req.nextUrl.searchParams.get('q') || '';
    const scope    = req.nextUrl.searchParams.get('scope') || 'mine';
    const filterEmp = req.nextUrl.searchParams.get('empleado_id') || '';

    const scopeWhere = getScopedAppointmentWhere(userId, userRole, scope, filterEmp);

    const citas = await prisma.cita.findMany({
      where: {
        ...(estado && estado !== 'all' ? { estado: estado as any } : {}),
        ...scopeWhere,
      },
      include: {
        empleado: { select: { nombre: true, tituloCliente: true } },
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
    const { userId, userRole } = getUserContext(req);

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'Usuario no identificado' }, { status: 401 });
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
      forzar,
    } = body;

    let finalEmpleadoId = empleado_id;
    if (userRole === 'EMPLEADO') {
      finalEmpleadoId = userId;
    }

    // Resolver servicios
    let serviciosParaCita: { id: string; duracion: number; precio: number }[] = [];
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
          duracion: typeof sel.duracion === 'number' && sel.duracion > 0 ? sel.duracion : (sDb?.duracion || 30),
          precio: sDb?.precio ? Number(sDb.precio) : 0
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
      serviciosParaCita = serviciosDbOrdenados.map((s: any) => ({
        id: s.id,
        duracion: s.duracion,
        precio: s.precio ? Number(s.precio) : 0
      }));
    }

    const duracionCalculada = serviciosParaCita.reduce((sum, s) => sum + s.duracion, 0);
    const montoCalculado = serviciosParaCita.reduce((sum, s) => sum + s.precio, 0);
    const primerServicioId  = serviciosParaCita[0].id;

    // ─── VALIDACIÓN DE DISPONIBILIDAD ───────────────────────────────────────
    // Si el admin o tech support manda forzar: true, se omite la validación de colisiones
    const esForzado = forzar === true && (userRole === 'ADMIN' || userRole === 'TECH_SUPPORT');
    const permitirHorarioExtendido = userRole === 'ADMIN' || userRole === 'EMPLEADO' || userRole === 'TECH_SUPPORT';

    const { calcularDisponibilidad, validarHoraExacta } = await import('@/lib/disponibilidad');
    const disponibilidad = await calcularDisponibilidad(
      finalEmpleadoId,
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
          empleado_id:      finalEmpleadoId,
          fecha:            parseLocalDateToUTC(fecha.split('T')[0]),
          hora,
          duracion:         duracionCalculada,
          notas,
          monto:            montoCalculado,
          created_by:       userId,
        },
      });

      await tx.citaServicio.createMany({
        data: serviciosParaCita.map((s, index) => ({
          cita_id:     c.id,
          servicio_id: s.id,
          duracion:    s.duracion,
          orden:       index,
          precio:      s.precio,
        }))
      });

      return c;
    });

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: 'APPOINTMENT_CREATED',
      module: 'CITAS',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail: req.headers.get('x-user-email'),
      entityType: 'Cita',
      entityId: cita.id,
      entityName: cliente_nombre,
      description: `Cita creada para ${cliente_nombre}.${esForzado ? ' (Acción forzada)' : ''}`,
      afterData: cita,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: { forzado: esForzado }
    });

    return NextResponse.json({ cita, mensaje: 'Cita creada exitosamente con sus servicios' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
