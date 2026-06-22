import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'El correo electrónico es requerido' }, { status: 400 });
    }

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'El código de 6 dígitos es requerido' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Buscar al empleado y verificar el token activo
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token_hash: codeHash,
        empleado: {
          correo: trimmedEmail,
        },
        used_at: null,
        expires_at: { gte: new Date() },
      },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: 'El código de verificación es incorrecto, ya ha sido utilizado o ha expirado.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { mensaje: 'Código verificado correctamente. Procede a cambiar tu contraseña.' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[VERIFY_CODE_API_ERROR]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
