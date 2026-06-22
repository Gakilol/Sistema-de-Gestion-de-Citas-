import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { sendResetPasswordEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email || body.correo;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'El correo electrónico es requerido' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Buscar al empleado por correo
    const empleado = await prisma.empleado.findUnique({
      where: { correo: trimmedEmail },
    });

    // Mensaje genérico de éxito para evitar enumeración de usuarios
    const genericResponse = NextResponse.json(
      { mensaje: 'Si el correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña en unos momentos.' },
      { status: 200 }
    );

    if (!empleado || !empleado.activo) {
      // Registrar en consola para debugging pero retornar éxito genérico al cliente
      console.log(`[FORGOT_PASSWORD] Intento de recuperación para correo no registrado o inactivo: ${trimmedEmail}`);
      return genericResponse;
    }

    // 2. Rate Limiting basado en base de datos (máximo 3 peticiones en 15 minutos)
    const quinceMinutosAgo = new Date(Date.now() - 15 * 60 * 1000);
    const peticionesRecientes = await prisma.passwordResetToken.count({
      where: {
        user_id: empleado.id,
        created_at: { gte: quinceMinutosAgo },
      },
    });

    if (peticionesRecientes >= 3) {
      return NextResponse.json(
        { error: 'Has excedido el límite de solicitudes de recuperación. Por favor espera 15 minutos e inténtalo de nuevo.' },
        { status: 429 }
      );
    }

    // Obtener IP del cliente (si está disponible)
    const clientIp = req.headers.get('x-forwarded-for') || req.ip || null;

    // 3. Generar token criptográfico único
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiracion = new Date(Date.now() + 60 * 60 * 1000); // 1 hora de validez

    // Invalida de forma lógica tokens anteriores del mismo usuario que no hayan expirado
    await prisma.passwordResetToken.updateMany({
      where: {
        user_id: empleado.id,
        expires_at: { gte: new Date() },
        used_at: null,
      },
      data: {
        expires_at: new Date(), // forzar expiración inmediata
      },
    });

    // Guardar el nuevo token hash en la base de datos
    await prisma.passwordResetToken.create({
      data: {
        user_id: empleado.id,
        token_hash: tokenHash,
        expires_at: expiracion,
        request_ip: clientIp,
      },
    });

    // 4. Enviar el correo usando el transporter de nodemailer
    try {
      await sendResetPasswordEmail({
        email: empleado.correo,
        nombre: empleado.nombre,
        token: token,
      });
      console.log(`[FORGOT_PASSWORD] Enlace de recuperación enviado exitosamente a: ${empleado.correo}`);
    } catch (mailError) {
      console.error('[FORGOT_PASSWORD] Error crítico al enviar correo SMTP:', mailError);
      return NextResponse.json(
        { error: 'Error al enviar el correo de recuperación. Por favor contacta al soporte técnico.' },
        { status: 500 }
      );
    }

    return genericResponse;
  } catch (error: any) {
    console.error('[FORGOT_PASSWORD_API_ERROR]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
