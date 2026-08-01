import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/hash';
import { signToken, signRefreshToken } from '@/lib/jwt';
import { loginSchema } from '@/lib/validation/auth-schemas';
import { z } from 'zod';

export class AuthService {
  static async login(credentials: z.infer<typeof loginSchema>) {
    const validCredentials = loginSchema.parse(credentials);

    const employee = await prisma.empleado.findUnique({
      where: { correo: validCredentials.email },
    });

    if (!employee || !employee.activo) {
      throw new Error('Credenciales inválidas o cuenta inactiva');
    }

    const passwordIsValid = await verifyPassword(validCredentials.password, employee.passwordHash);

    if (!passwordIsValid) {
      throw new Error('Credenciales inválidas');
    }

    const tokenPayload = {
      id: employee.id,
      email: employee.correo,
      rol: employee.rol,
    };

    const accessToken = await signToken(tokenPayload);
    const refreshToken = await signRefreshToken({ id: employee.id });

    return {
      accessToken,
      refreshToken,
      usuario: { id: employee.id, nombre: employee.nombre, email: employee.correo, rol: employee.rol },
    };
  }
}
