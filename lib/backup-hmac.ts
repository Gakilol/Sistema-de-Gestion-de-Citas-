import crypto from 'crypto';

const SECRET = process.env.BACKUP_WORKER_SECRET || 'fallback-secret-de-backup-citas';
const MAX_TIME_DRIFT_SECONDS = 300; // 5 minutos de ventana de tiempo

/**
 * Genera la firma HMAC SHA-256 para una petición.
 * @param timestamp Unix timestamp en segundos
 * @param nonce UUID o valor aleatorio único
 * @param body Cuerpo serializado de la petición (JSON string o vacío)
 */
export function generarFirma(timestamp: string, nonce: string, body: string): string {
  const data = `${timestamp}.${nonce}.${body}`;
  return crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('hex');
}

/**
 * Valida la firma HMAC, el timestamp y la cabecera de autorización.
 * @param authorizationHeader Valor de la cabecera Authorization (Bearer <token>)
 * @param timestamp Cabecera X-Backup-Timestamp
 * @param nonce Cabecera X-Backup-Nonce
 * @param signature Cabecera X-Backup-Signature
 * @param body Cuerpo de la petición
 */
export function validarPeticion(
  authorizationHeader: string | null,
  timestamp: string | null,
  nonce: string | null,
  signature: string | null,
  body: string
): { valido: boolean; error?: string } {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return { valido: false, error: 'Cabecera de autorización inválida o ausente' };
  }

  const token = authorizationHeader.substring(7);
  if (token !== SECRET) {
    return { valido: false, error: 'Token de autorización inválido' };
  }

  if (!timestamp || !nonce || !signature) {
    return { valido: false, error: 'Cabeceras de firma incompletas' };
  }

  // Validar ventana de tiempo (máximo 5 minutos de deriva temporal)
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    return { valido: false, error: 'Timestamp inválido' };
  }

  const ahora = Math.floor(Date.now() / 1000);
  if (Math.abs(ahora - timestampNum) > MAX_TIME_DRIFT_SECONDS) {
    return { valido: false, error: 'Petición expirada (deriva temporal excesiva)' };
  }

  // Calcular la firma esperada
  const firmaEsperada = generarFirma(timestamp, nonce, body);
  if (signature !== firmaEsperada) {
    return { valido: false, error: 'Firma HMAC inválida' };
  }

  return { valido: true };
}

/**
 * Helper para generar cabeceras de firma para enviar una petición.
 * @param body Objeto body a enviar o string
 */
export function obtenerCabecerasFirma(body: any = ''): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const signature = generarFirma(timestamp, nonce, bodyStr);

  return {
    'Authorization': `Bearer ${SECRET}`,
    'X-Backup-Timestamp': timestamp,
    'X-Backup-Nonce': nonce,
    'X-Backup-Signature': signature,
    'Content-Type': 'application/json',
  };
}
