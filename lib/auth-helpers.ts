// lib/auth-helpers.ts
import { NextRequest } from 'next/server';
import { verifyJwtSync } from '@/lib/jwt';

export interface UserContext {
  userId: string | null;
  userRole: string | null;
  userEmail: string | null;
}
/**
 * Obtiene el contexto del usuario autenticado desde la solicitud.
 *
 * SEGURIDAD:
 * 1. Lee las cabeceras x-user-* inyectadas por el middleware (que ya verificó el JWT).
 * 2. Si las cabeceras no están (ej. rutas /api/auth/* que son públicas), como fallback
 *    verifica criptográficamente el JWT de la cookie usando HMAC-SHA256.
 * 3. NUNCA confía en datos enviados directamente por el cliente sin verificación.
 *    Las cabeceras son eliminadas del cliente en middleware antes de inyectar las propias.
 */
export function getUserContext(req: NextRequest): UserContext {
  // Las cabeceras x-user-* fueron inyectadas por el middleware DESPUÉS de verificar el JWT.
  // El middleware también elimina cualquier cabecera x-user-* enviada por el cliente.
  const userId = req.headers.get('x-user-id');
  const userRole = req.headers.get('x-user-role');
  const userEmail = req.headers.get('x-user-email');

  // Si el middleware inyectó los datos, los usamos directamente (ya fueron verificados)
  if (userId && userRole) {
    return { userId, userRole, userEmail };
  }

  // Fallback SEGURO: Verificar el JWT criptográficamente desde la cookie.
  // Esto aplica para rutas /api/auth/* que son públicas y el middleware no inyecta cabeceras,
  // pero que aún necesitan leer el usuario si está autenticado (ej. /api/auth/me).
  const token = req.cookies.get('access_token')?.value;
  if (token) {
    const payload = verifyJwtSync(token); // Verifica firma HMAC-SHA256 + expiración
    if (payload) {
      return {
        userId: payload.id,
        userRole: payload.rol,
        userEmail: payload.email,
      };
    }
  }

  return {
    userId: null,
    userRole: null,
    userEmail: null,
  };
}


export function canViewAllAppointments(role: string | null): boolean {
  return role === 'ADMIN' || role === 'TECH_SUPPORT';
}

export function canManageAppointment(role: string | null): boolean {
  return role === 'ADMIN' || role === 'TECH_SUPPORT' || role === 'EMPLEADO';
}

export function getScopedAppointmentWhere(
  userId: string,
  role: string,
  scope?: string | null,
  filterEmpleadoId?: string | null
) {
  if (role === 'EMPLEADO') {
    return { empleado_id: userId };
  }

  // TECH_SUPPORT y consultas con scope='all'
  if (role === 'TECH_SUPPORT' || scope === 'all') {
    if (filterEmpleadoId && filterEmpleadoId !== '') {
      return { empleado_id: filterEmpleadoId };
    }
    return {};
  }

  // Default scope for ADMIN is 'mine'
  return { empleado_id: userId };
}
