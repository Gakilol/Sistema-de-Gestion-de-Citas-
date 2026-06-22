const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'resettoken',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'sessiontoken',
  'cookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'bankaccount',
  'pass',
  'contrasena',
  'contraseña',
  'hash',
  'token_hash'
];

export function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle Date objects
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeAuditData(item));
  }

  // Handle Objects
  if (typeof data === 'object') {
    // If it has a custom toJSON (like some decimal/bigint wrappers or custom classes),
    // we want to sanitize the result of toJSON, unless it's a Buffer or similar.
    if (typeof data.toJSON === 'function') {
      try {
        return sanitizeAuditData(data.toJSON());
      } catch {
        // Fallback if toJSON fails
      }
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // If the key is sensitive, we remove/replace it.
      // The instruction says "Eliminar completamente, no solo ocultar"
      // So we will delete it (i.e. omit it from the sanitized object)
      const isSensitive = SENSITIVE_KEYS.some(sensitiveKey => 
        lowerKey.includes(sensitiveKey)
      );

      if (isSensitive) {
        // Omit completely
        continue;
      }

      // Handle BigInt serialization
      if (typeof value === 'bigint') {
        sanitized[key] = value.toString();
      } else {
        sanitized[key] = sanitizeAuditData(value);
      }
    }
    return sanitized;
  }

  // Handle primitive values
  if (typeof data === 'bigint') {
    return data.toString();
  }

  return data;
}
