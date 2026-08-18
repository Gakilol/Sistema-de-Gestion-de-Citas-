/**
 * Determina si un rol puede ver y usar los datos de contacto de un cliente
 * inactivo. ADMIN puede contactar a cualquier cliente; EMPLEADO únicamente a
 * clientes que ya atendió; TECH_SUPPORT conserva la PII enmascarada.
 */
export function canContactInactiveClient(role: string, hasServedClient: boolean): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'EMPLEADO') return hasServedClient;
  return false;
}
