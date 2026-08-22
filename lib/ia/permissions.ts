import type { IAToolName, IAUserRole } from './types';

const ALL_TOOLS = new Set<IAToolName>([
  'getTodayAppointments',
  'getAppointmentSummary',
  'searchClients',
  'searchServices',
  'getAvailableSlots',
  'getPopularServices',
  'getStaffWorkload',
  'prepareCreateClient',
  'prepareCreateAppointment',
  'prepareUpdateAppointmentStatus',
]);

const PERMISSIONS: Record<IAUserRole, Set<IAToolName>> = {
  ADMIN: ALL_TOOLS,
  TECH_SUPPORT: ALL_TOOLS,
  EMPLEADO: ALL_TOOLS,
};

export function isKnownRole(role: string | null): role is IAUserRole {
  return role === 'ADMIN' || role === 'EMPLEADO' || role === 'TECH_SUPPORT';
}

export function checkToolPermission(tool: string, role: IAUserRole): tool is IAToolName {
  return PERMISSIONS[role].has(tool as IAToolName);
}
