// lib/auth-helpers.ts
import { NextRequest } from 'next/server';

export interface UserContext {
  userId: string | null;
  userRole: string | null;
  userEmail: string | null;
}

export function getUserContext(req: NextRequest): UserContext {
  return {
    userId: req.headers.get('x-user-id'),
    userRole: req.headers.get('x-user-role'),
    userEmail: req.headers.get('x-user-email'),
  };
}

export function canViewAllAppointments(role: string | null): boolean {
  return role === 'ADMIN' || role === 'TECH_SUPPORT';
}

export function canManageAppointment(role: string | null): boolean {
  return role === 'ADMIN' || role === 'TECH_SUPPORT' || role === 'EMPLEADO';
}

export function getScopedAppointmentWhere(userId: string, role: string) {
  if (role === 'EMPLEADO') {
    return { empleado_id: userId };
  }
  return {};
}
