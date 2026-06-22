import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAuditAuth } from '@/lib/audit/audit-auth';
import { mapLegacyAuditLog } from '@/lib/audit/audit-logger';

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(
  req: NextRequest,
  props: RouteContext
) {
  const params = await props.params;
  const auth = checkAuditAuth(req);
  if ('error' in auth) return auth.error;

  const { id } = params;

  try {
    const log = await prisma.auditLog.findUnique({
      where: { id }
    });

    if (!log) {
      return NextResponse.json({ error: 'Registro de auditoría no encontrado.' }, { status: 404 });
    }

    // Obtener empleados para mapear realizadoPor
    const employees = await prisma.empleado.findMany({
      select: { id: true, nombre: true, correo: true, rol: true }
    });
    const employeesMap = new Map(employees.map(e => [e.id, e]));

    // Mapear log con compatibilidad legacy
    const mappedLog = mapLegacyAuditLog(log, employeesMap);

    return NextResponse.json(mappedLog);
  } catch (err: any) {
    console.error(`[/api/auditoria/logs/${id}]`, err);
    return NextResponse.json({ error: 'Error al obtener el detalle de auditoría.' }, { status: 500 });
  }
}
