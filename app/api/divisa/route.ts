import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '../../../src/lib/db';

// ─── GET /api/divisa  → obtiene configuración de tipo de cambio
export async function GET() {
  try {
    const config = await prisma.configuracion.findUnique({ where: { id: 'default' } });
    const negocio = (config?.negocio ?? {}) as Record<string, any>;
    return NextResponse.json({
      moneda: negocio.moneda ?? 'USD',
      tipoCambio: negocio.tipoCambio ?? 36.5,  // valor por defecto NIO/USD
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── PATCH /api/divisa  → solo admins pueden actualizar tipo de cambio
export async function PATCH(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo los administradores pueden modificar el tipo de cambio' }, { status: 403 });
    }

    const body = await req.json();
    const { moneda, tipoCambio } = body;

    if (tipoCambio !== undefined && (isNaN(tipoCambio) || tipoCambio <= 0)) {
      return NextResponse.json({ error: 'El tipo de cambio debe ser un número positivo' }, { status: 400 });
    }

    const current = await prisma.configuracion.findUnique({ where: { id: 'default' } });
    const negocioActual = (current?.negocio ?? {}) as Record<string, any>;

    await prisma.configuracion.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        negocio: {
          ...negocioActual,
          ...(moneda !== undefined ? { moneda } : {}),
          ...(tipoCambio !== undefined ? { tipoCambio: Number(tipoCambio) } : {}),
        },
      },
      update: {
        negocio: {
          ...negocioActual,
          ...(moneda !== undefined ? { moneda } : {}),
          ...(tipoCambio !== undefined ? { tipoCambio: Number(tipoCambio) } : {}),
        },
      },
    });

    return NextResponse.json({ mensaje: 'Tipo de cambio actualizado' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
