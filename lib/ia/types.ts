export type IAUserRole = 'ADMIN' | 'EMPLEADO' | 'TECH_SUPPORT';

export type IAToolName =
  | 'getTodayAppointments'
  | 'getAppointmentSummary'
  | 'searchClients'
  | 'getPopularServices'
  | 'getStaffWorkload';

export type IAToolResult =
  | { ok: true; data: unknown; meta: { fuenteDatos: string } }
  | { ok: false; error: string; code: 'ACCESS_DENIED' | 'INVALID_PARAMS' | 'INTERNAL_ERROR' };

export interface IAExecutionContext {
  userId: string;
  userRole: IAUserRole;
}
