import { prisma } from '../lib/db';
import { verifyPassword } from '../auth/hash';
import { signToken, signRefreshToken } from '../auth/jwt';
import { LoginSchema } from '../validadores';
import { z } from 'zod';

export class AuthServicio {
  static async login(datos: z.infer<typeof LoginSchema>) {
    const dataValidada = LoginSchema.parse(datos);

    const empleado = await prisma.empleado.findUnique({
      where: { correo: dataValidada.email },
    });

    if (!empleado || !empleado.activo) {
      throw new Error('Credenciales inválidas o cuenta inactiva');
    }

    const esValida = await verifyPassword(dataValidada.password, empleado.passwordHash);

    if (!esValida) {
      throw new Error('Credenciales inválidas');
    }

    const tokenPayload = {
      id: empleado.id,
      email: empleado.correo,
      rol: empleado.rol,
    };

    const accessToken = await signToken(tokenPayload);
    const refreshToken = await signRefreshToken({ id: empleado.id });

    return {
      accessToken,
      refreshToken,
      usuario: { id: empleado.id, nombre: empleado.nombre, email: empleado.correo, rol: empleado.rol },
    };
  }
}
