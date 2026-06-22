import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAuditAuth } from '@/lib/audit/audit-auth';
import { logAudit } from '@/lib/audit/audit-logger';
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
  const where: any = {
    createdAt: {
      gte: startOfDay(fromDate),
      lte: endOfDay(toDate)
    }
  };

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

  const errorsOnly = sp.get('errorsOnly') === 'true';
  if (errorsOnly) where.status = 'FAILED';

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

  const search = sp.get('search');
  if (search) {
    where.OR = [
      { userName: { contains: search, mode: 'insensitive' } },
      { userEmail: { contains: search, mode: 'insensitive' } },
      { action: { contains: search, mode: 'insensitive' } },
      { module: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ];
  }

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
        ipAddress: true
      }
    });

    // Registrar exportación en la auditoría
    await logAudit({
      action: 'AUDIT_LOG_EXPORTED',
      module: 'AUDITORIA',
      status: 'SUCCESS',
      userId: auth.userId,
      userRole: auth.role,
      userEmail: auth.email,
      description: `Reporte de auditoría exportado en formato ${formato.toUpperCase()} (${logs.length} registros).`,
      metadata: { formato, totalRegistros: logs.length, from: rawFrom, to: rawTo }
    });

    if (formato === 'pdf') {
      // Para PDF, en lugar de generar un PDF binario complejo en el servidor (que puede fallar en edge o serverless),
      // devolvemos los datos estructurados con una cabecera especial para que el cliente genere el PDF en el navegador.
      // Así garantizamos compatibilidad al 100% con Vercel y evitamos dependencias pesadas de Canvas en Node.js.
      return NextResponse.json({
        meta: {
          sistema: 'NovaCita - Gestión de Citas',
          reporte: 'Historial de Auditoría del Sistema',
          fechaGeneracion: new Date().toISOString(),
          usuario: auth.email,
          rango: `${rawFrom || 'Inicio'} a ${rawTo || 'Fin'}`,
          total: logs.length
        },
        logs
      });
    }

    // CSV y Excel
    const headersList = ['Fecha y Hora', 'Usuario', 'Email', 'Rol', 'Modulo', 'Accion', 'Entidad Afectada', 'ID Entidad', 'Descripcion', 'Estado', 'IP'];
    
    // Generar contenido CSV
    let csvContent = '\uFEFF'; // BOM para Excel UTF-8
    csvContent += headersList.join(',') + '\n';

    logs.forEach(log => {
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
        const cleanVal = val.replace(/"/g, '""');
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
