// lib/normalize-phone.ts
// Normalización central de teléfonos para Nicaragua (+505) y Costa Rica (+506).
// Reglas:
//   - Elimina espacios, guiones, paréntesis y signos +.
//   - Si el teléfono está vacío o compuesto solo por espacios, retorna null.
//   - Evita duplicar prefijo si ya incluye 505 o 506.
//   - Para Nicaragua (505), valida que el número local tenga exactamente 8 dígitos.
//   - Formato unificado de retorno: "505XXXXXXXX" o "506XXXXXXXX".

export interface TelefonoValidationResult {
  normalized: string | null;
  isValid: boolean;
  error?: string;
}

/**
 * Valida y normaliza un número telefónico.
 */
export function validarYNormalizarTelefono(
  telefono: string | null | undefined,
  defaultCountryCode: string = '506'
): TelefonoValidationResult {
  if (telefono === null || telefono === undefined) {
    return { normalized: null, isValid: true };
  }

  const rawTrimmed = telefono.trim();
  if (rawTrimmed === '') {
    return { normalized: null, isValid: true };
  }

  // Eliminar todo lo que no sea dígito
  const digitsOnly = rawTrimmed.replace(/\D/g, '');

  if (digitsOnly.length === 0) {
    return { normalized: null, isValid: true };
  }

  // Caso 1: Tiene 11 dígitos y empieza con 505 o 506 (prefijo de 3 dígitos + 8 locales)
  if (digitsOnly.length === 11) {
    const prefix = digitsOnly.slice(0, 3);
    const localPart = digitsOnly.slice(3);

    if (prefix === '505' || prefix === '506') {
      return { normalized: digitsOnly, isValid: true };
    }
  }

  // Caso 2: Tiene 8 dígitos (número local sin prefijo internacional)
  if (digitsOnly.length === 8) {
    const code = ['505', '506'].includes(defaultCountryCode) ? defaultCountryCode : '506';
    return { normalized: `${code}${digitsOnly}`, isValid: true };
  }

  // Si tiene prefijo 505 pero la cantidad de dígitos tras el prefijo no es 8
  if (digitsOnly.startsWith('505') && digitsOnly.length !== 11) {
    const localLen = digitsOnly.length - 3;
    return {
      normalized: null,
      isValid: false,
      error: `El número de Nicaragua debe tener exactamente 8 dígitos locales (se recibieron ${localLen}).`,
    };
  }

  // Si tiene prefijo 506 pero la cantidad de dígitos tras el prefijo no es 8
  if (digitsOnly.startsWith('506') && digitsOnly.length !== 11) {
    const localLen = digitsOnly.length - 3;
    return {
      normalized: null,
      isValid: false,
      error: `El número de Costa Rica debe tener exactamente 8 dígitos locales (se recibieron ${localLen}).`,
    };
  }

  // Si la longitud total no es 8 ni 11
  return {
    normalized: null,
    isValid: false,
    error: `El número de teléfono no es válido. Debe tener 8 dígitos locales (recibidos ${digitsOnly.length}).`,
  };
}

/**
 * Normaliza un número telefónico para almacenamiento/WhatsApp.
 * Retorna string en formato internacional (ej. "50688887777") o null si es inválido/vacío.
 */
export function normalizarTelefono(
  telefono: string | null | undefined,
  defaultCountryCode: string = '506'
): string | null {
  const result = validarYNormalizarTelefono(telefono, defaultCountryCode);
  return result.isValid ? result.normalized : null;
}

/**
 * Valida si un teléfono normalizado es apto para WhatsApp o almacenamiento.
 */
export function esTelefonoValido(
  telefono: string | null | undefined,
  defaultCountryCode: string = '506'
): boolean {
  return validarYNormalizarTelefono(telefono, defaultCountryCode).isValid;
}

