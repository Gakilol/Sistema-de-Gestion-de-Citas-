import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAuditAuth } from '@/lib/audit/audit-auth';
import { mapLegacyAuditLogs } from '@/lib/audit/audit-logger';
import { differenceInDays, isValid, startOfDay, endOfDay } from 'date-fns';

export async function GET(req: NextRequest) {
  const auth = checkAuditAuth(req);
  if ('error' in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // Filtros de fecha
  const rawFrom = sp.get('from') || '';
  const rawTo = sp.get('to') || '';

  const defaultTo = new Date();
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 días

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

  // Construir consulta Prisma relacional mediante AND conditions
  const andConditions: any[] = [
    {
      createdAt: {
        gte: startOfDay(fromDate),
        lte: endOfDay(toDate)
      }
    }
  ];

  // Filtros específicos
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

  const entityTypeParam = sp.get('entityType');
  if (entityTypeParam) {
    andConditions.push({ OR: [{ entityType: entityTypeParam }, { entidad: entityTypeParam }] });
  }

  const entityIdParam = sp.get('entityId');
  if (entityIdParam) {
    andConditions.push({ OR: [{ entityId: entityIdParam }, { entidadId: entityIdParam }] });
  }

  // Filtros especiales
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

  const criticalOnly = sp.get('criticalOnly') === 'true';
  if (criticalOnly) {
    andConditions.push({
      OR: [
        {
          action: {
            in: [
              'SETTINGS_UPDATED',
              'THEME_SETTINGS_UPDATED',
              'ROLE_CHANGED',
              'PERMISSIONS_CHANGED',
              'BACKUP_RESTORE_COMPLETED',
              'USER_DELETED',
              'USER_DEACTIVATED',
              'CLIENT_DELETED',
              'APPOINTMENT_DELETED'
            ]
          }
        },
        {
          AND: [
            { entidad: { in: ['Cita', 'Cliente', 'Empleado'] } },
            { accion: { in: ['ELIMINAR', 'CANCELAR'] } }
          ]
        }
      ]
    });
  }

  // Búsqueda global por texto
  const search = sp.get('search');
  if (search) {
    andConditions.push({
      OR: [
        { userName: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { module: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { entityName: { contains: search, mode: 'insensitive' } },
        { entidad: { contains: search, mode: 'insensitive' } },
        { accion: { contains: search, mode: 'insensitive' } },
        { realizadoPor: { contains: search, mode: 'insensitive' } }
      ]
    });
  }

  const where = { AND: andConditions };

  // Ordenamiento
  const orderByParam = sp.get('orderBy') || 'createdAt';
  const orderDirection = sp.get('orderDirection') || 'desc';
  const allowedSortFields = ['createdAt', 'userName', 'module', 'status'];
  
  const orderBy: any = {};
  if (allowedSortFields.includes(orderByParam)) {
    orderBy[orderByParam] = orderDirection === 'asc' ? 'asc' : 'desc';
  } else {
    orderBy.createdAt = 'desc';
  }

  try {
    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take: limit,
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
          errorMessage: true,
          // Legacy fields for mapping fallback
          entidad: true,
          entidadId: true,
          accion: true,
          realizadoPor: true,
          fecha: true
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    // Obtener empleados para mapear realizadoPor
    const employees = await prisma.empleado.findMany({
      select: { id: true, nombre: true, correo: true, rol: true }
    });
    const employeesMap = new Map(employees.map(e => [e.id, e]));

    // Mapear logs con los valores legacy si los nuevos son null
    const mappedLogs = mapLegacyAuditLogs(logs, employeesMap);

    return NextResponse.json({
      logs: mappedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    console.error('[/api/auditoria/logs]', err);
    return NextResponse.json({ error: 'Error al obtener registros de auditoría.' }, { status: 500 });
  }
}
