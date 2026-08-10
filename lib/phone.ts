export interface PhoneValidationResult {
  normalized: string | null;
  isValid: boolean;
  error?: string;
}

/**
 * Valida y normaliza un número telefónico.
 */
export function validateAndNormalizePhone(
  phone: string | null | undefined,
  defaultCountryCode: string = '506'
): PhoneValidationResult {
  if (phone === null || phone === undefined) {
    return { normalized: null, isValid: true };
  }

  const rawTrimmed = phone.trim();
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
export function normalizePhone(
  phone: string | null | undefined,
  defaultCountryCode: string = '506'
): string | null {
  const result = validateAndNormalizePhone(phone, defaultCountryCode);
  return result.isValid ? result.normalized : null;
}
