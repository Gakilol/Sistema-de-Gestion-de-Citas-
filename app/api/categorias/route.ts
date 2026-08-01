import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logLegacyAudit } from '@/lib/audit/legacy-audit';
import { getUserContext } from '@/lib/auth-helpers';

const CreateCategoriaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100).trim(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Formato de color hexadecimal inválido (ej: #6366f1)').optional().default('#6366f1'),
  orden: z.number().int().min(0).max(1000).optional().default(0),
  activo: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const onlyActive = req.nextUrl.searchParams.get('activo') === 'true';
    const categorias = await prisma.categoria.findMany({
      where: onlyActive ? { activo: true } : undefined,
      orderBy: [
        { orden: 'asc' },
        { nombre: 'asc' }
      ]
    });
    return NextResponse.json({ categorias }, { status: 200 });
  } catch (error: any) {
    console.error('[CATEGORIAS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Error interno al consultar categorías' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, userRole } = getUserContext(req);
    if (userRole !== 'ADMIN' && userRole !== 'TECH_SUPPORT') {
      return NextResponse.json({ error: 'Solo los administradores y soporte técnico pueden crear categorías' }, { status: 403 });
    }

    const rawBody = await req.json();
    const parseResult = CreateCategoriaSchema.safeParse({
      ...rawBody,
      orden: rawBody.orden !== undefined ? Number(rawBody.orden) : undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Datos de categoría inválidos', detalles: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { nombre, color, orden, activo } = parseResult.data;

    // Verificar si ya existe una categoría con ese nombre
    const existente = await prisma.categoria.findUnique({
      where: { nombre }
    });

    if (existente) {
      return NextResponse.json({ error: 'Ya existe una categoría con este nombre' }, { status: 400 });
    }

    const categoria = await prisma.categoria.create({
      data: {
        nombre,
        color,
        orden,
        activo,
      },
    });

    await logLegacyAudit({
      entidad: 'Categoria',
      entidadId: categoria.id,
      accion: 'CREAR',
      detalles: { nombre: categoria.nombre, color: categoria.color },
      realizadoPor: userId,
    });

    return NextResponse.json({ categoria, mensaje: 'Categoría creada exitosamente' }, { status: 201 });
  } catch (error: any) {
    console.error('[CATEGORIAS_POST_ERROR]', error);
    return NextResponse.json({ error: 'No se pudo crear la categoría' }, { status: 500 });
  }
}
