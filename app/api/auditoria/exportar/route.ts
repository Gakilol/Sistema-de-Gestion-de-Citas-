import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAuditAuth } from '@/lib/audit/audit-auth';
import { logAudit, mapLegacyAuditLogs } from '@/lib/audit/audit-logger';
import { differenceInDays, isValid, startOfDay, endOfDay } from 'date-fns';

export async function GET(req: NextRequest) {
  const auth = checkAuditAuth(req);
  if ('error' in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const formato = sp.get('formato') || sp.get('format') || 'csv';

  // Filtros de fecha
  const rawFrom = sp.get('from') || '';
  const rawTo = sp.get('to') || '';

  const defaultTo = new Date();
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const fromDate = rawFrom ? new Date(rawFrom + 'T00:00:00Z') : defaultFrom;
  const toDate = rawTo ? new Date(rawTo + 'T23:59:59Z') : defaultTo;

  if (!isValid(fromDate) || !isValid(toDate)) {
    return NextResponse.json({ error: 'Fechas inválidas. Formato YYYY-MM-DD.' }, { status: 400 });
  }

  if (fromDate > toDate) {
    return NextResponse.json({ error: 'La fecha de inicio no puede ser mayor que la de fin.' }, { status: 400 });
  }

  if (differenceInDays(toDate, fromDate) > 365) {
    return NextResponse.json({ error: 'El rango de fechas no puede exceder los 365 días.' }, { status: 400 });
  }

  // Filtros
  const andConditions: any[] = [
    {
      createdAt: {
        gte: startOfDay(fromDate),
        lte: endOfDay(toDate)
      }
    }
  ];

  const moduleParam = sp.get('module');
  if (moduleParam) {
    if (moduleParam === 'CITAS') {
      andConditions.push({ OR: [{ module: 'CITAS' }, { entidad: 'Cita' }] });
    } else if (moduleParam === 'USUARIOS') {
      andConditions.push({ OR: [{ module: 'USUARIOS' }, { entidad: 'Empleado' }] });
    } else if (moduleParam === 'CLIENTES') {
      andConditions.push({ OR: [{ module: 'CLIENTES' }, { entidad: 'Cliente' }] });
    } else if (moduleParam === 'SERVICIOS') {
      andConditions.push({ OR: [{ module: 'SERVICIOS' }, { entidad: 'Servicio' }] });
    } else if (moduleParam === 'CONFIGURACION') {
      andConditions.push({ OR: [{ module: 'CONFIGURACION' }, { entidad: 'Configuracion' }] });
    } else {
      andConditions.push({ module: moduleParam });
    }
  }

  const actionParam = sp.get('action');
  if (actionParam) {
    if (actionParam === 'APPOINTMENT_CREATED') {
      andConditions.push({ OR: [{ action: 'APPOINTMENT_CREATED' }, { AND: [{ entidad: 'Cita' }, { accion: 'CREAR' }] }] });
    } else if (actionParam === 'APPOINTMENT_UPDATED') {
      andConditions.push({ OR: [{ action: 'APPOINTMENT_UPDATED' }, { AND: [{ entidad: 'Cita' }, { accion: 'ACTUALIZAR' }] }] });
    } else if (actionParam === 'APPOINTMENT_DELETED') {
      andConditions.push({ OR: [{ action: 'APPOINTMENT_DELETED' }, { AND: [{ entidad: 'Cita' }, { accion: 'ELIMINAR' }] }] });
    } else if (actionParam === 'APPOINTMENT_CANCELLED') {
      andConditions.push({ OR: [{ action: 'APPOINTMENT_CANCELLED' }, { AND: [{ entidad: 'Cita' }, { accion: 'CANCELAR' }] }] });
    } else if (actionParam === 'USER_CREATED') {
      andConditions.push({ OR: [{ action: 'USER_CREATED' }, { AND: [{ entidad: 'Empleado' }, { accion: 'CREAR' }] }] });
    } else if (actionParam === 'USER_UPDATED') {
      andConditions.push({ OR: [{ action: 'USER_UPDATED' }, { AND: [{ entidad: 'Empleado' }, { accion: 'ACTUALIZAR' }] }] });
    } else if (actionParam === 'USER_DELETED') {
      andConditions.push({ OR: [{ action: 'USER_DELETED' }, { AND: [{ entidad: 'Empleado' }, { accion: 'ELIMINAR' }] }] });
    } else if (actionParam === 'CLIENT_CREATED') {
      andConditions.push({ OR: [{ action: 'CLIENT_CREATED' }, { AND: [{ entidad: 'Cliente' }, { accion: 'CREAR' }] }] });
    } else if (actionParam === 'CLIENT_UPDATED') {
      andConditions.push({ OR: [{ action: 'CLIENT_UPDATED' }, { AND: [{ entidad: 'Cliente' }, { accion: 'ACTUALIZAR' }] }] });
    } else if (actionParam === 'CLIENT_DELETED') {
      andConditions.push({ OR: [{ action: 'CLIENT_DELETED' }, { AND: [{ entidad: 'Cliente' }, { accion: 'ELIMINAR' }] }] });
    } else if (actionParam === 'SETTINGS_UPDATED') {
      andConditions.push({ OR: [{ action: 'SETTINGS_UPDATED' }, { AND: [{ entidad: 'Configuracion' }, { accion: 'ACTUALIZAR' }] }] });
    } else {
      andConditions.push({ action: actionParam });
    }
  }

  const userIdParam = sp.get('userId');
  if (userIdParam) {
    andConditions.push({ OR: [{ userId: userIdParam }, { realizadoPor: userIdParam }] });
  }

  const roleParam = sp.get('role');
  if (roleParam) {
    andConditions.push({ userRole: roleParam });
  }

  const statusParam = sp.get('status');
  if (statusParam) {
    if (statusParam === 'SUCCESS') {
      andConditions.push({ OR: [{ status: 'SUCCESS' }, { status: null }] });
    } else {
      andConditions.push({ status: statusParam });
    }
  }

  const errorsOnly = sp.get('errorsOnly') === 'true';
  if (errorsOnly) {
    andConditions.push({ status: 'FAILED' });
  }

  const securityOnly = sp.get('securityOnly') === 'true';
  if (securityOnly) {
    andConditions.push({
      action: {
        in: [
          'LOGIN_FAILED',
          'UNAUTHORIZED_ACCESS_ATTEMPT',
          'FORBIDDEN_API_ACCESS',
          'INVALID_TOKEN_ATTEMPT',
          'RATE_LIMIT_EXCEEDED',
          'SESSION_REVOKED',
          'PASSWORD_RESET_REQUESTED',
          'PASSWORD_CHANGED'
        ]
      }
    });
  }

  const search = sp.get('search');
  if (search) {
    andConditions.push({
      OR: [
        { userName: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { module: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { entidad: { contains: search, mode: 'insensitive' } },
        { accion: { contains: search, mode: 'insensitive' } },
        { realizadoPor: { contains: search, mode: 'insensitive' } }
      ]
    });
  }

  const where = { AND: andConditions };

  try {
    const count = await prisma.auditLog.count({ where });

    // Validar límites estrictos
    if ((formato === 'csv' || formato === 'excel' || formato === 'xlsx') && count > 5000) {
      return NextResponse.json({
        error: `Límite excedido. El rango filtrado contiene ${count} registros, pero el máximo para CSV/Excel es 5,000. Reduzca el rango de fechas o aplique más filtros.`
      }, { status: 400 });
    }

    if (formato === 'pdf' && count > 1000) {
      return NextResponse.json({
        error: `Límite excedido. El rango filtrado contiene ${count} registros, pero el máximo para PDF es 1,000. Reduzca el rango de fechas o aplique más filtros.`
      }, { status: 400 });
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        userName: true,
        userEmail: true,
        userRole: true,
        module: true,
        action: true,
        entityType: true,
        entityId: true,
        entityName: true,
        description: true,
        status: true,
        ipAddress: true,
        // Legacy fields for mapping fallback
        entidad: true,
        entidadId: true,
        accion: true,
        realizadoPor: true,
        fecha: true
      }
    });

    // Obtener empleados para mapear realizadoPor
    const employees = await prisma.empleado.findMany({
      select: { id: true, nombre: true, correo: true, rol: true }
    });
    const employeesMap = new Map(employees.map(e => [e.id, e]));

    // Mapear logs con los valores legacy si los nuevos son null
    const mappedLogs = mapLegacyAuditLogs(logs, employeesMap);

    // Registrar exportación en la auditoría
    await logAudit({
      action: 'AUDIT_LOG_EXPORTED',
      module: 'AUDITORIA',
      status: 'SUCCESS',
      userId: auth.userId,
      userRole: auth.role,
      userEmail: auth.email,
      description: `Reporte de auditoría exportado en formato ${formato.toUpperCase()} (${mappedLogs.length} registros).`,
      metadata: { formato, totalRegistros: mappedLogs.length, from: rawFrom, to: rawTo }
    });

    if (formato === 'pdf') {
      return NextResponse.json({
        meta: {
          sistema: 'NovaCita - Gestión de Citas',
          reporte: 'Historial de Auditoría del Sistema',
          fechaGeneracion: new Date().toISOString(),
          usuario: auth.email,
          rango: `${rawFrom || 'Inicio'} a ${rawTo || 'Fin'}`,
          total: mappedLogs.length
        },
        logs: mappedLogs
      });
    }

    // CSV y Excel
    const headersList = ['Fecha y Hora', 'Usuario', 'Email', 'Rol', 'Modulo', 'Accion', 'Entidad Afectada', 'ID Entidad', 'Descripcion', 'Estado', 'IP'];
    
    // Generar contenido CSV
    let csvContent = '\uFEFF'; // BOM para Excel UTF-8
    csvContent += headersList.join(',') + '\n';

    mappedLogs.forEach(log => {
      const row = [
        log.createdAt.toISOString(),
        log.userName || '',
        log.userEmail || '',
        log.userRole || '',
        log.module || '',
        log.action || '',
        log.entityType || '',
        log.entityId || '',
        log.description || '',
        log.status || '',
        log.ipAddress || ''
      ].map(val => {
        // Sanitizar comillas para evitar romper CSV
        const cleanVal = (val || '').replace(/"/g, '""');
        return `"${cleanVal}"`;
      });
      csvContent += row.join(',') + '\n';
    });

    const responseHeaders = new Headers();
    if (formato === 'excel' || formato === 'xlsx') {
      responseHeaders.set('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      responseHeaders.set('Content-Disposition', `attachment; filename="auditoria_${rawFrom || 'export'}.csv"`);
    } else {
      responseHeaders.set('Content-Type', 'text/csv; charset=utf-8');
      responseHeaders.set('Content-Disposition', `attachment; filename="auditoria_${rawFrom || 'export'}.csv"`);
    }

    return new Response(csvContent, {
      status: 200,
      headers: responseHeaders
    });

  } catch (err: any) {
    console.error('[/api/auditoria/exportar]', err);
    return NextResponse.json({ error: 'Error al exportar registros de auditoría.' }, { status: 500 });
  }
}
