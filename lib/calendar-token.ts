// lib/calendar-token.ts
// Genera y verifica tokens HMAC-SHA256 para enlaces públicos de calendario.
// El token contiene: citaId, hora, updatedAt, exp (expiración).
// Se invalida automáticamente si la cita se reprograma, cancela o el token expira.

import crypto from 'crypto';

function getCalendarLinkSecret(): string {
  return process.env.CALENDAR_LINK_SECRET || process.env.JWT_SECRET || '';
}

interface TokenPayload {
  citaId: string;
  hora: string;
  updatedAt: string;
  exp: number;
}

/**
 * Codifica un buffer a base64url (RFC 7515).
 */
function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodifica un string base64url a Buffer.
 */
function fromBase64Url(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  return Buffer.from(base64, 'base64');
}

/**
 * Firma un payload con HMAC-SHA256.
 */
function firmar(payloadB64: string): string {
  const secret = getCalendarLinkSecret();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  return toBase64Url(hmac.digest());
}

/**
 * Genera un token firmado para el enlace de calendario de una cita.
 *
 * @param cita Objeto con los campos necesarios de la cita.
 * @param horaFin Hora de finalización para calcular la expiración.
 * @param fecha Fecha de la cita en formato YYYY-MM-DD.
 * @returns Token firmado como string.
 */
export function generarTokenCalendario(cita: {
  id: string;
  hora: string;
  updated_at: Date | string;
  fecha: Date | string;
  duracion: number;
}): string {
  const secret = getCalendarLinkSecret();
  if (!secret) {
    throw new Error('CALENDAR_LINK_SECRET no está configurado');
  }

  // Calcular expiración: 24 horas después de que termine la cita
  const fechaStr = typeof cita.fecha === 'string'
    ? cita.fecha.split('T')[0]
    : cita.fecha.toISOString().split('T')[0];
  const [year, month, day] = fechaStr.split('-').map(Number);
  const [h, m] = cita.hora.split(':').map(Number);
  // Construir la fecha+hora de fin en America/Costa_Rica (UTC-6)
  const inicioMs = Date.UTC(year, month - 1, day, h + 6, m); // +6 para compensar UTC-6
  const finMs = inicioMs + cita.duracion * 60 * 1000;
  const expMs = finMs + 24 * 60 * 60 * 1000; // +24h después del fin

  const updatedAtStr = typeof cita.updated_at === 'string'
    ? cita.updated_at
    : cita.updated_at.toISOString();

  const payload: TokenPayload = {
    citaId: cita.id,
    hora: cita.hora,
    updatedAt: updatedAtStr,
    exp: Math.floor(expMs / 1000),
  };

  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signature = firmar(payloadB64);

  return `${payloadB64}.${signature}`;
}

/**
 * Verifica un token HMAC y retorna el payload si es válido.
 * Retorna null si el token es inválido, alterado o expirado.
 */
export function verificarTokenCalendario(token: string): TokenPayload | null {
  const secret = getCalendarLinkSecret();
  if (!secret || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signatureB64] = parts;

  // Verificar firma con comparación segura (timing-safe)
  const expectedSignature = firmar(payloadB64);

  const sigBuf = fromBase64Url(signatureB64);
  const expectedBuf = fromBase64Url(expectedSignature);

  if (sigBuf.length !== expectedBuf.length) return null;

  try {
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  // Decodificar payload
  let payload: TokenPayload;
  try {
    const decoded = fromBase64Url(payloadB64).toString('utf8');
    payload = JSON.parse(decoded);
  } catch {
    return null;
  }

  // Validar estructura
  if (!payload.citaId || !payload.hora || !payload.updatedAt || !payload.exp) {
    return null;
  }

  // Verificar expiración
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds > payload.exp) {
    return null;
  }

  return payload;
}
