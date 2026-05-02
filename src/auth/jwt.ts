import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

interface CustomJWTPayload extends JWTPayload {
  id: string;
  email: string;
  rol: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'secret-muy-seguro-para-jwt-saas';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secret-para-refresh-token';

const getJwtSecretKey = (secret: string) => {
  return new TextEncoder().encode(secret);
};

export const signToken = async (payload: CustomJWTPayload): Promise<string> => {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h') // Token expira en 1 hora
    .sign(getJwtSecretKey(JWT_SECRET));
};

export const signRefreshToken = async (payload: { id: string }): Promise<string> => {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Refresh token expira en 7 días
    .sign(getJwtSecretKey(JWT_REFRESH_SECRET));
};

export const verifyToken = async (token: string): Promise<CustomJWTPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(JWT_SECRET));
    return payload as CustomJWTPayload;
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = async (token: string): Promise<{ id: string } | null> => {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(JWT_REFRESH_SECRET));
    return payload as { id: string };
  } catch (error) {
    return null;
  }
};
