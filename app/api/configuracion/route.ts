import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../src/lib/db';

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
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden modificar la configuración' }, { status: 403 });
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

    return NextResponse.json({ config: updated, mensaje: 'Configuración guardada exitosamente' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
