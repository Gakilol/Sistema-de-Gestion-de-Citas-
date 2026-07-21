import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import crypto from 'crypto';
import { getJwtRefreshSecret, getJwtSecret } from './security-secrets';

export interface CustomJWTPayload extends JWTPayload {
  id: string;
  email: string;
  rol: string;
}

function requireSecret(secret: string | null, name: string): string {
  if (!secret) throw new Error(`${name}_NOT_CONFIGURED`);
  return secret;
}

const getJwtSecretKey = (secret: string) => new TextEncoder().encode(secret);

export const signToken = async (payload: CustomJWTPayload): Promise<string> => {
  const secret = requireSecret(getJwtSecret(), 'JWT_SECRET');
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecretKey(secret));
};

export const signRefreshToken = async (payload: { id: string }): Promise<string> => {
  const secret = requireSecret(getJwtRefreshSecret(), 'JWT_REFRESH_SECRET');
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecretKey(secret));
};

export const verifyToken = async (token: string): Promise<CustomJWTPayload | null> => {
  try {
    const secret = getJwtSecret();
    if (!secret) return null;
    const { payload } = await jwtVerify(token, getJwtSecretKey(secret));
    return payload as CustomJWTPayload;
  } catch {
    return null;
  }
};

export const verifyRefreshToken = async (token: string): Promise<{ id: string } | null> => {
  try {
    const secret = getJwtRefreshSecret();
    if (!secret) return null;
    const { payload } = await jwtVerify(token, getJwtSecretKey(secret));
    return payload as { id: string };
  } catch {
    return null;
  }
};

/** Synchronous JWT verification for route helpers that cannot await. */
export function verifyJwtSync(token: string): CustomJWTPayload | null {
  try {
    const secret = getJwtSecret();
    if (!secret) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');

    const actual = Buffer.from(signatureB64, 'utf8');
    const expected = Buffer.from(expectedSignature, 'utf8');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as CustomJWTPayload;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    if (!payload.id || !payload.email || !payload.rol) return null;

    return payload;
  } catch {
    return null;
  }
}
