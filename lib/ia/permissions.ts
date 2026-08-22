import type { IAToolName, IAUserRole } from './types';

const ALL_READ_TOOLS = new Set<IAToolName>([
  'getTodayAppointments',
  'getAppointmentSummary',
  'searchClients',
  'getPopularServices',
  'getStaffWorkload',
]);

const PERMISSIONS: Record<IAUserRole, Set<IAToolName>> = {
  ADMIN: ALL_READ_TOOLS,
  TECH_SUPPORT: ALL_READ_TOOLS,
  EMPLEADO: ALL_READ_TOOLS,
};

export function isKnownRole(role: string | null): role is IAUserRole {
  return role === 'ADMIN' || role === 'EMPLEADO' || role === 'TECH_SUPPORT';
}

export function checkToolPermission(tool: string, role: IAUserRole): tool is IAToolName {
  return PERMISSIONS[role].has(tool as IAToolName);
}
