// lib/normalize-phone.ts
// Normalización central de teléfonos para WhatsApp.
// Reglas:
//   - Elimina espacios, guiones, paréntesis y otros caracteres no numéricos (excepto +).
//   - Mantiene el código internacional si ya existe.
//   - Para números costarricenses de 8 dígitos, agrega 506.
//   - Retorna null si el teléfono es inválido o está vacío.
//   - NO modifica el teléfono guardado en la base de datos.
//   - NO registra el teléfono completo en logs.

/**
 * Normaliza un número telefónico para uso con WhatsApp.
 * @returns String con solo dígitos y código de país, o null si es inválido.
 */
export function normalizarTelefono(telefono: string | null | undefined): string | null {
  if (!telefono || typeof telefono !== 'string') return null;

  // Eliminar todo excepto dígitos y +
  let cleaned = telefono.replace(/[^\d+]/g, '');

  // Si empieza con +, removemos el + y dejamos los dígitos
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Eliminar cualquier carácter no numérico restante
  cleaned = cleaned.replace(/\D/g, '');

  // Validar que queden dígitos
  if (!cleaned || cleaned.length < 7) return null;

  // Si es un número costarricense de 8 dígitos (sin código de país)
  if (cleaned.length === 8) {
    return `506${cleaned}`;
  }

  // Si ya tiene código de país (más de 8 dígitos), retornar como está
  // Validar longitud razonable (entre 10 y 15 dígitos con código de país)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return cleaned;
  }

  // Si tiene 9 dígitos podría ser un caso especial; asumimos CR con formato raro
  if (cleaned.length === 9 && !cleaned.startsWith('506')) {
    return null; // Ambiguo, mejor no adivinar
  }

  // Si tiene exactamente 11 dígitos y empieza con 506, es CR completo
  if (cleaned.length === 11 && cleaned.startsWith('506')) {
    return cleaned;
  }

  return cleaned.length >= 7 ? cleaned : null;
}

/**
 * Valida si un teléfono normalizado es apto para WhatsApp.
 */
export function esTelefonoValido(telefono: string | null | undefined): boolean {
  return normalizarTelefono(telefono) !== null;
}
