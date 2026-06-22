import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { hashPassword } from '@/lib/hash';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, token, password } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'El correo electrónico es requerido' }, { status: 400 });
    }

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'El código de verificación es requerido' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Hash del token (código de 6 dígitos) recibido para comparar con el hash guardado en DB (SHA256)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // 2. Buscar token en DB asociándolo con el correo
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token_hash: tokenHash,
        empleado: {
          correo: trimmedEmail,
        },
      },
      include: { empleado: true },
    });

    if (!resetToken) {
      return NextResponse.json({ error: 'El token es inválido o ya ha expirado' }, { status: 400 });
    }

    // 3. Validar expiración y uso
    if (resetToken.used_at !== null) {
      return NextResponse.json({ error: 'Este token ya ha sido utilizado' }, { status: 400 });
    }

    if (resetToken.expires_at < new Date()) {
      return NextResponse.json({ error: 'El token de recuperación ha expirado' }, { status: 400 });
    }

    if (!resetToken.empleado || !resetToken.empleado.activo) {
      return NextResponse.json({ error: 'La cuenta asociada ya no se encuentra activa' }, { status: 400 });
    }

    // 4. Hashear la nueva contraseña y actualizar
    const newPasswordHash = await hashPassword(password);

    await prisma.$transaction([
      // Actualizar contraseña del empleado
      prisma.empleado.update({
        where: { id: resetToken.user_id },
        data: { passwordHash: newPasswordHash },
      }),
      // Marcar token como usado
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used_at: new Date() },
      }),
    ]);

    console.log(`[RESET_PASSWORD] Contraseña restablecida exitosamente para el usuario: ${resetToken.empleado.correo}`);

    return NextResponse.json(
      { mensaje: 'Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[RESET_PASSWORD_API_ERROR]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
