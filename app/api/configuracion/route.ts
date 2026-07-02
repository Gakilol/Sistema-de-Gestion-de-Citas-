import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { getUserContext } from '@/lib/auth-helpers';

// ─── GET /api/configuracion
export async function GET() {
  try {
    const config = await prisma.configuracion.findUnique({ where: { id: 'default' } });
    return NextResponse.json({ config: config || {} });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── PATCH /api/configuracion
export async function PATCH(req: NextRequest) {
  try {
    const { userId, userRole, userEmail } = getUserContext(req);
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo administradores y soporte técnico pueden modificar la configuración' }, { status: 403 });
    }

    const body = await req.json();
    const { negocio, horarios, whatsapp, apariencia } = body;

    const current = await prisma.configuracion.findUnique({ where: { id: 'default' } });

    const updated = await prisma.configuracion.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        negocio: negocio ?? current?.negocio ?? {},
        horarios: horarios ?? current?.horarios ?? {},
        whatsapp: whatsapp ?? current?.whatsapp ?? {},
        apariencia: apariencia ?? current?.apariencia ?? {},
      },
      update: {
        ...(negocio ? { negocio } : {}),
        ...(horarios ? { horarios } : {}),
        ...(whatsapp ? { whatsapp } : {}),
        ...(apariencia ? { apariencia } : {}),
      },
    });

    // Detectar tipo de acción
    let finalAction = 'SETTINGS_UPDATED';
    let finalDesc = 'Configuración general del negocio actualizada.';
    
    if (apariencia && !negocio && !horarios && !whatsapp) {
      finalAction = 'THEME_SETTINGS_UPDATED';
      finalDesc = 'Configuración de apariencia y tema visual actualizada.';
    } else if (horarios && !negocio && !whatsapp && !apariencia) {
      finalAction = 'BUSINESS_HOURS_UPDATED';
      finalDesc = 'Horarios comerciales del negocio actualizados.';
    }

    const { logAudit, getClientIp } = await import('@/lib/audit/audit-logger');
    await logAudit({
      action: finalAction,
      module: 'CONFIGURACION',
      status: 'SUCCESS',
      userId: userId || undefined,
      userRole: userRole || undefined,
      userEmail,
      entityType: 'Configuracion',
      entityId: 'default',
      entityName: 'Configuración General',
      description: finalDesc,
      beforeData: current,
      afterData: updated,
      ipAddress: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: { seccionesModificadas: Object.keys(body).filter(k => body[k] !== undefined) }
    });

    return NextResponse.json({ config: updated, mensaje: 'Configuración guardada exitosamente' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
