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

export function getScopedAppointmentWhere(
  userId: string,
  role: string,
  scope?: string | null,
  filterEmpleadoId?: string | null
) {
  if (role === 'EMPLEADO') {
    return { empleado_id: userId };
  }

  // ADMIN and TECH_SUPPORT
  if (scope === 'all') {
    if (filterEmpleadoId && filterEmpleadoId !== '') {
      return { empleado_id: filterEmpleadoId };
    }
    return {};
  }

  // Default scope is 'mine'
  return { empleado_id: userId };
}

export interface ClienteObjeto {
  id: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  notas: string | null;
  createdByUserId: string | null;
  citas?: any[];
  [key: string]: any;
}

export function maskClientDataIfRestricted(
  cliente: ClienteObjeto,
  userId: string | null,
  userRole: string | null
): any {
  if (!userRole || userRole === 'ADMIN' || userRole === 'TECH_SUPPORT') {
    return {
      ...cliente,
      _privado: false
    };
  }

  // Si es Empleado, tiene acceso si:
  // 1. Él lo registró (createdByUserId === userId)
  // 2. Tiene o tuvo alguna cita asignada con él
  const isRegisteredByMe = cliente.createdByUserId === userId;
  
  // Buscar si alguna cita está asignada a este empleado
  const hasCitasWithMe = Array.isArray(cliente.citas) && cliente.citas.some((cita: any) => {
    // Si la cita tiene empleado_id directamente o en un objeto anidado
    const empId = cita.empleado_id || (cita.empleado && cita.empleado.id);
    return empId === userId;
  });

  if (isRegisteredByMe || hasCitasWithMe) {
    return {
      ...cliente,
      _privado: false
    };
  }

  // Enmascarar datos sensibles y filtrar el historial de citas para mostrar solo las suyas
  const filteredHistorial = Array.isArray(cliente.historial)
    ? cliente.historial.filter((cita: any) => {
        const empId = cita.empleado_id || (cita.empleado && cita.empleado.id);
        return empId === userId;
      })
    : (Array.isArray(cliente.citas)
        ? cliente.citas.filter((cita: any) => {
            const empId = cita.empleado_id || (cita.empleado && cita.empleado.id);
            return empId === userId;
          })
        : []);

  return {
    ...cliente,
    telefono: cliente.telefono ? '••••••••' : null,
    correo: cliente.correo ? '••••••••' : null,
    notas: cliente.notas ? '••••••••' : null,
    historial: filteredHistorial, // Mostrar solo citas asociadas a este empleado
    _privado: true
  };
}

