import crypto from 'crypto';

const REMEMBER_DEVICE_SECRET = process.env.REMEMBER_DEVICE_SECRET || process.env.JWT_SECRET || 'fallback-dev-only-secret-remember-device';

export const REMEMBER_COOKIE_NAME = 'remember_token';
export const REMEMBER_COOKIE_MAX_AGE = 60 * 24 * 60 * 60; // 60 días en segundos

/**
 * Genera un token aleatorio seguro de 32 bytes en formato hexadecimal.
 */
export function generateRememberToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashea un token usando SHA-256 y un secreto del servidor para fortalecerlo.
 */
export function hashRememberToken(token: string): string {
  return crypto
    .createHmac('sha256', REMEMBER_DEVICE_SECRET)
    .update(token)
    .digest('hex');
}

/**
 * Parsea el User-Agent para retornar una representación legible y amigable del dispositivo.
 */
export function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Dispositivo desconocido';

  let os = 'Desconocido';
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = 'Navegador';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera';

  return `${browser} - ${os}`;
}
