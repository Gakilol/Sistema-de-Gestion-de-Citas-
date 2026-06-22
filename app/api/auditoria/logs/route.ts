import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAuditAuth } from '@/lib/audit/audit-auth';
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

  // Construir consulta Prisma
  const where: any = {
    createdAt: {
      gte: startOfDay(fromDate),
      lte: endOfDay(toDate)
    }
  };

  // Filtros específicos
  const moduleParam = sp.get('module');
  if (moduleParam) where.module = moduleParam;

  const actionParam = sp.get('action');
  if (actionParam) where.action = actionParam;

  const userIdParam = sp.get('userId');
  if (userIdParam) where.userId = userIdParam;

  const roleParam = sp.get('role');
  if (roleParam) where.userRole = roleParam;

  const statusParam = sp.get('status');
  if (statusParam) where.status = statusParam;

  const entityTypeParam = sp.get('entityType');
  if (entityTypeParam) where.entityType = entityTypeParam;

  const entityIdParam = sp.get('entityId');
  if (entityIdParam) where.entityId = entityIdParam;

  // Filtros especiales
  const errorsOnly = sp.get('errorsOnly') === 'true';
  if (errorsOnly) {
    where.status = 'FAILED';
  }

  const securityOnly = sp.get('securityOnly') === 'true';
  if (securityOnly) {
    where.action = {
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
    };
  }

  const criticalOnly = sp.get('criticalOnly') === 'true';
  if (criticalOnly) {
    where.action = {
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
    };
  }

  // Búsqueda global por texto
  const search = sp.get('search');
  if (search) {
    where.OR = [
      { userName: { contains: search, mode: 'insensitive' } },
      { userEmail: { contains: search, mode: 'insensitive' } },
      { action: { contains: search, mode: 'insensitive' } },
      { module: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { entityName: { contains: search, mode: 'insensitive' } }
    ];
  }

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
        // Evitamos N+1 y seleccionamos campos específicos
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
          errorMessage: true
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    return NextResponse.json({
      logs,
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
