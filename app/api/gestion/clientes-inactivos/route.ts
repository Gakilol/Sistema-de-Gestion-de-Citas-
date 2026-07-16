import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserContext } from '@/lib/auth-helpers';
import { parseLocalDateToUTC } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  try {
    const { userId, userRole, userEmail } = getUserContext(req);
    if (!userId || !userRole) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const sp = req.nextUrl.searchParams;
    const diasInactividad = Math.min(Math.max(parseInt(sp.get('dias') || '90'), 1), 730);

    // Filters
    const busqueda = sp.get('q') || '';
    const telefono = sp.get('telefono') || '';
    const servicioFiltro = sp.get('servicioId') || '';
    const estadoRecordatorio = sp.get('estadoRecordatorio') || ''; // 'none' | 'recent' | 'old' | 'failed'
    
    // Scope and Employee filtering
    let scope = sp.get('scope') || 'mine';
    let targetEmpleadoId = sp.get('empleadoId') || '';

    // Enforce EMPLEADO permissions:
    // Employees can NEVER see all, and can only see their own clients
    if (userRole === 'EMPLEADO') {
      scope = 'mine';
      targetEmpleadoId = userId;
    } else {
      // ADMIN or TECH_SUPPORT
      if (scope === 'mine') {
        targetEmpleadoId = userId;
      }
    }

    // Pagination
    const page = Math.max(parseInt(sp.get('page') || '1'), 1);
    const pageSize = Math.min(Math.max(parseInt(sp.get('size') || '25'), 5), 100);
    const skip = (page - 1) * pageSize;

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - diasInactividad * 86400000);

    // Filter by employee determines if we match appointments with a specific professional
    const filtrarPorEmpleado = !!targetEmpleadoId;

    // 1. Get raw inactive clients list matching inactivity threshold and employee scope
    // We group by Client and find the overall maximum completed appointment date.
    // If the overall maximum is before the cutoff, the client is inactive.
    const clientesInactivosRaw: any[] = await prisma.$queryRaw`
      SELECT
        c."id",
        c."nombre",
        c."telefono",
        MAX(ci."fecha") AS ultima_cita,
        COUNT(ci."id")::INT AS total_citas,
        COUNT(ci."id") FILTER (WHERE ci."estado" = 'COMPLETADA')::INT AS completadas,
        COUNT(ci."id") FILTER (WHERE ci."estado" = 'CANCELADA')::INT AS canceladas,
        COUNT(ci."id") FILTER (WHERE ci."estado" = 'NO_SHOW')::INT AS no_shows
      FROM "Cliente" c
      INNER JOIN "Cita" ci ON ci."cliente_id" = c."id"
      WHERE ci."estado" = 'COMPLETADA'
      GROUP BY c."id", c."nombre", c."telefono"
      HAVING
        -- Last completed appointment is before cutoff date
        MAX(ci."fecha") < ${cutoffDate}
        -- No future bookings
        AND NOT EXISTS (
          SELECT 1 FROM "Cita" fc
          WHERE fc."cliente_id" = c."id"
            AND fc."fecha" > ${now}
            AND fc."estado" IN ('PENDIENTE', 'CONFIRMADA', 'REPROGRAMADA')
        )
        -- Scoping: has at least one appointment with target employee if filtering is on
        AND (${filtrarPorEmpleado} = FALSE OR EXISTS (
          SELECT 1 FROM "Cita" emp_ci
          WHERE emp_ci."cliente_id" = c."id"
            AND emp_ci."empleado_id" = ${targetEmpleadoId}
        ))
      ORDER BY MAX(ci."fecha") ASC
    `;

    // 2. Fetch latest completed appointments for these clients to enrich with last service/professional
    const allRawIds = clientesInactivosRaw.map((r: any) => r.id);
    let enrichedClients: any[] = [];
    let stats = {
      totalInactivos: 0,
      sinRecordatorio: 0,
      enviadosEsteMes: 0,
      reagendados: 0
    };

    if (allRawIds.length > 0) {
      // Get all completed appointments for these clients to find the absolute latest one (with service & professional)
      const lastCompletedAppointments = await prisma.cita.findMany({
        where: {
          cliente_id: { in: allRawIds },
          estado: 'COMPLETADA'
        },
        orderBy: [
          { fecha: 'desc' },
          { hora: 'desc' },
          { created_at: 'desc' }
        ],
        include: {
          servicio: { select: { id: true, nombre: true } },
          empleado: { select: { id: true, nombre: true } }
        }
      });

      // Map client to their latest completed appointment
      const latestApptMap: Record<string, any> = {};
      for (const appt of lastCompletedAppointments) {
        if (!appt.cliente_id) continue;
        if (!latestApptMap[appt.cliente_id]) {
          latestApptMap[appt.cliente_id] = appt;
        }
      }

      // Fetch all reminder logs for these clients
      const reminderLogs = await prisma.auditLog.findMany({
        where: {
          entityType: 'Cliente',
          entityId: { in: allRawIds },
          module: 'CLIENTES_INACTIVOS',
          action: 'REMINDER_SENT'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const latestReminderMap: Record<string, any> = {};
      for (const log of reminderLogs) {
        if (!log.entityId) continue;
        if (!latestReminderMap[log.entityId]) {
          latestReminderMap[log.entityId] = log;
        }
      }

      // Calculate stats (based on the scoped list of inactive clients)
      stats.totalInactivos = allRawIds.length;

      // Count "sin recordatorio" (no reminder log ever)
      const clientsWithReminder = new Set(reminderLogs.map((l: any) => l.entityId));
      stats.sinRecordatorio = allRawIds.filter(id => !clientsWithReminder.has(id)).length;

      // Count "enviados este mes" (reminders created in current calendar month)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const thisMonthRemindersCount = await prisma.auditLog.count({
        where: {
          module: 'CLIENTES_INACTIVOS',
          action: 'REMINDER_SENT',
          status: 'SUCCESS',
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          },
          // If scoping, restrict by sending user or target employee
          ...(userRole === 'EMPLEADO' ? { userId: userId } : {})
        }
      });
      stats.enviadosEsteMes = thisMonthRemindersCount;

      // Count "reagendados" (clients who received a reminder, and later had a new appointment created)
      // For simplicity, we check: client has a reminder, and also a Cita created_at > reminder.createdAt
      let reagendadosCount = 0;
      const uniqueReminderClients = Array.from(clientsWithReminder) as string[];
      if (uniqueReminderClients.length > 0) {
        for (const clientId of uniqueReminderClients) {
          const latestReminder = latestReminderMap[clientId];
          if (!latestReminder) continue;
          
          const newBookingAfterReminder = await prisma.cita.findFirst({
            where: {
              cliente_id: clientId,
              created_at: {
                gt: latestReminder.createdAt
              }
            }
          });
          if (newBookingAfterReminder) {
            reagendadosCount++;
          }
        }
      }
      stats.reagendados = reagendadosCount;

      // Map raw records to enriched objects
      enrichedClients = clientesInactivosRaw.map((r: any) => {
        const lastAppt = latestApptMap[r.id];
        const lastReminder = latestReminderMap[r.id];

        let diasDesdeUltimoReminder: number | null = null;
        if (lastReminder) {
          diasDesdeUltimoReminder = Math.floor((now.getTime() - new Date(lastReminder.createdAt).getTime()) / 86400000);
        }

        // Privacy rule: Employees can only see contact details of their own clients
        // Mask details if this is not the employee's client (i.e. they never attended them)
        // Wait, since we already restricted the raw SQL to only return clients who have at least one appointment
        // with the logged in employee, the employee inherently HAS access to all returned records!
        // But let's double check to be safe:
        const hasAccess = userRole !== 'EMPLEADO' || (
          lastAppt && lastAppt.empleado_id === userId
        ) || lastCompletedAppointments.some((appt: any) => appt.cliente_id === r.id && appt.empleado_id === userId);

        const maskedTelefono = hasAccess ? r.telefono : '••••••••';

        return {
          id: r.id,
          nombre: r.nombre,
          telefono: maskedTelefono || null,
          telefonoRaw: hasAccess ? r.telefono : null,
          ultimaCita: r.ultima_cita,
          diasSinVisita: Math.floor((now.getTime() - new Date(r.ultima_cita).getTime()) / 86400000),
          totalCitas: Number(r.total_citas),
          completadas: Number(r.completadas),
          canceladas: Number(r.canceladas),
          noShows: Number(r.no_shows),
          
          // Latest service and professional
          ultimoServicioNombre: lastAppt?.servicio?.nombre || '—',
          ultimoServicioId: lastAppt?.servicio?.id || null,
          ultimoProfesionalNombre: lastAppt?.empleado?.nombre || '—',
          ultimoProfesionalId: lastAppt?.empleado?.id || null,

          // Last reminder details
          ultimoRecordatorioFecha: lastReminder ? lastReminder.createdAt : null,
          ultimoRecordatorioEstado: lastReminder ? lastReminder.status : null,
          diasDesdeUltimoRecordatorio: diasDesdeUltimoReminder,
          _privado: !hasAccess
        };
      });

      // Apply search, phone, service, and reminder filters in JS
      if (busqueda) {
        const q = busqueda.toLowerCase().trim();
        enrichedClients = enrichedClients.filter(c => c.nombre.toLowerCase().includes(q));
      }
      if (telefono) {
        const tel = telefono.trim();
        enrichedClients = enrichedClients.filter(c => c.telefono && c.telefono.includes(tel));
      }
      if (servicioFiltro) {
        enrichedClients = enrichedClients.filter(c => c.ultimoServicioId === servicioFiltro);
      }
      if (estadoRecordatorio) {
        enrichedClients = enrichedClients.filter(c => {
          if (estadoRecordatorio === 'none') {
            return !c.ultimoRecordatorioFecha;
          }
          if (estadoRecordatorio === 'recent') {
            return c.ultimoRecordatorioFecha && c.diasDesdeUltimoRecordatorio !== null && c.diasDesdeUltimoRecordatorio <= 7;
          }
          if (estadoRecordatorio === 'old') {
            return c.ultimoRecordatorioFecha && c.diasDesdeUltimoRecordatorio !== null && c.diasDesdeUltimoRecordatorio > 7;
          }
          if (estadoRecordatorio === 'failed') {
            return c.ultimoRecordatorioEstado === 'FAILED';
          }
          return true;
        });
      }
    }

    const total = enrichedClients.length;
    const paginated = enrichedClients.slice(skip, skip + pageSize);

    return NextResponse.json({
      clientes: paginated,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      },
      stats
    }, { status: 200 });

  } catch (error: any) {
    console.error('[/api/gestion/clientes-inactivos]', error);
    return NextResponse.json({ error: 'Error interno del servidor: ' + error.message }, { status: 500 });
  }
}
