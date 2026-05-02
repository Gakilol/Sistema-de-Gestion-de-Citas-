import { prisma } from '../lib/db';
import { hashPassword, verifyPassword } from '../auth/hash';
import { signToken, signRefreshToken } from '../auth/jwt';
import { RegistroSchema, LoginSchema } from '../validadores';
import { z } from 'zod';
import { RolUsuario } from '@prisma/client';

export class AuthServicio {
  static async registrar(datos: z.infer<typeof RegistroSchema>) {
    const dataValidada = RegistroSchema.parse(datos);

    const existeUsuario = await prisma.usuario.findUnique({
      where: { email: dataValidada.email },
    });

    if (existeUsuario) {
      throw new Error('El correo electrónico ya está registrado');
    }

    const passwordHash = await hashPassword(dataValidada.password);

    const usuario = await prisma.usuario.create({
      data: {
        nombre: dataValidada.nombre,
        email: dataValidada.email,
        passwordHash,
        telefono: dataValidada.telefono,
        rol: RolUsuario.CLIENTE,
      },
    });

    return {
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    };
  }

  static async login(datos: z.infer<typeof LoginSchema>) {
    const dataValidada = LoginSchema.parse(datos);

    const usuario = await prisma.usuario.findUnique({
      where: { email: dataValidada.email },
    });

    if (!usuario || !usuario.activo) {
      throw new Error('Credenciales inválidas o usuario inactivo');
    }

    const esValida = await verifyPassword(dataValidada.password, usuario.passwordHash);

    if (!esValida) {
      throw new Error('Credenciales inválidas');
    }

    const tokenPayload = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    };

    const accessToken = await signToken(tokenPayload);
    const refreshToken = await signRefreshToken({ id: usuario.id });

    return {
      accessToken,
      refreshToken,
      usuario: tokenPayload,
    };
  }
}
