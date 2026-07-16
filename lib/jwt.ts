import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import crypto from 'crypto';

export interface CustomJWTPayload extends JWTPayload {
  id: string;
  email: string;
  rol: string;
}

// ─── Obtener secretos seguros sin fallbacks inseguros ─────────────────────────
function getRequiredSecret(envVar: string, fallbackForDev: string): string {
  const secret = process.env[envVar];
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[SEGURIDAD CRÍTICA] Variable de entorno ${envVar} requerida no está configurada en producción.`);
    }
    console.warn(`[ADVERTENCIA DE SEGURIDAD] ${envVar} no está configurada. Usando clave de desarrollo por defecto.`);
    return fallbackForDev;
  }
  return secret;
}

function getJwtSecret(): string {
  return getRequiredSecret('JWT_SECRET', 'dev-only-secret-jwt-change-me-in-production');
}

function getJwtRefreshSecret(): string {
  if (process.env.JWT_REFRESH_SECRET) {
    return process.env.JWT_REFRESH_SECRET;
  }
  const mainSecret = process.env.JWT_SECRET;
  if (mainSecret) {
    return `${mainSecret}_refresh`;
  }
  return getRequiredSecret('JWT_REFRESH_SECRET', 'dev-only-secret-refresh-change-me-in-production');
}

const getJwtSecretKey = (secret: string) => {
  return new TextEncoder().encode(secret);
};

export const signToken = async (payload: CustomJWTPayload): Promise<string> => {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecretKey(getJwtSecret()));
};

export const signRefreshToken = async (payload: { id: string }): Promise<string> => {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecretKey(getJwtRefreshSecret()));
};

export const verifyToken = async (token: string): Promise<CustomJWTPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(getJwtSecret()));
    return payload as CustomJWTPayload;
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = async (token: string): Promise<{ id: string } | null> => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(getJwtRefreshSecret()));
    return payload as { id: string };
  } catch (error) {
    return null;
  }
};

/**
 * Verifica la firma de un JWT de forma síncrona usando HMAC-SHA256 nativo de Node.js.
 * SEGURO: Verifica criptográficamente la firma antes de usar el payload.
 * Uso: en contextos donde no se puede usar async/await (e.g., middleware Edge).
 *
 * @returns El payload decodificado si la firma es válida y el token no expiró, o null.
 */
export function verifyJwtSync(token: string): CustomJWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // 1. Verificar firma HMAC-SHA256
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', getJwtSecret())
      .update(signingInput)
      .digest('base64url');

    // Comparación en tiempo constante para prevenir timing attacks
    if (!crypto.timingSafeEqual(
      Buffer.from(signatureB64, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    )) {
      return null;
    }

    // 2. Decodificar payload
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as CustomJWTPayload;

    // 3. Verificar expiración
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    // 4. Verificar que contiene los campos requeridos
    if (!payload.id || !payload.email || !payload.rol) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
