/**
 * Centralized access to server-only security secrets.
 * These helpers intentionally never provide fallback values.
 */
type Environment = Record<string, string | undefined>;

function readSecret(name: string, env: Environment = process.env): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

export function getJwtSecret(env: Environment = process.env): string | null {
  return readSecret('JWT_SECRET', env);
}

/**
 * Keeps the existing refresh-secret derivation only after a real JWT secret is
 * configured, preserving valid refresh tokens without a public fallback.
 */
export function getJwtRefreshSecret(env: Environment = process.env): string | null {
  const refreshSecret = readSecret('JWT_REFRESH_SECRET', env);
  if (refreshSecret) return refreshSecret;

  const jwtSecret = getJwtSecret(env);
  return jwtSecret ? `${jwtSecret}_refresh` : null;
}

export function getRememberDeviceSecret(env: Environment = process.env): string | null {
  return readSecret('REMEMBER_DEVICE_SECRET', env) ?? getJwtSecret(env);
}

export function getCronSecret(env: Environment = process.env): string | null {
  return readSecret('CRON_SECRET', env);
}

/** Supports the Authorization header format used by Vercel Cron. */
export function isAuthorizedCronRequest(
  authorization: string | null,
  env: Environment = process.env
): boolean {
  const secret = getCronSecret(env);
  return secret !== null && authorization === `Bearer ${secret}`;
}
