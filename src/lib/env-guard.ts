export function isProduction(): boolean {
  return process.env.APP_ENV === 'production';
}

export function isStaging(): boolean {
  return process.env.APP_ENV === 'staging';
}

export function isDevelopment(): boolean {
  const env = process.env.APP_ENV;
  return !env || env === 'development' || env === 'dev';
}

export function isUsingProductionDatabase(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  // Identificador del proyecto de producción de Neon
  return dbUrl.includes('ep-odd-base-aj140b7z');
}

export function canWriteToDatabase(): boolean {
  // Regla crítica: si apunta a la base de datos de producción y NO estamos en producción real, bloquear
  if (isUsingProductionDatabase() && !isProduction()) {
    return false;
  }
  // En cualquier otro caso, verificar el flag explícito de escritura
  return process.env.ALLOW_DB_WRITES === 'true';
}

export function maskDatabaseUrl(url?: string): string {
  if (!url) return 'undefined';
  try {
    const parsed = new URL(url.replace('postgresql://', 'http://'));
    return `postgresql://***:***@${parsed.host}${parsed.pathname}`;
  } catch {
    if (url.includes('@')) {
      const parts = url.split('@');
      const before = parts[0].split(':');
      if (before.length >= 3) before[2] = '***';
      return before.join(':') + '@' + parts.slice(1).join('@');
    }
    return 'masked-url';
  }
}

export function assertCanWriteToDatabase(): void {
  if (!canWriteToDatabase()) {
    throw new Error(
      `🚨 [DATABASE WRITE BLOCKED] Se intentó realizar una operación de escritura bajo condiciones inseguras.\n` +
      `   APP_ENV: ${process.env.APP_ENV || 'no configurado'}\n` +
      `   DATABASE_URL (parcial): ${maskDatabaseUrl(process.env.DATABASE_URL)}\n` +
      `   ALLOW_DB_WRITES: ${process.env.ALLOW_DB_WRITES || 'no configurado'}\n` +
      `   Motivo: Conexión local a producción detectada o escrituras de BD deshabilitadas por política de seguridad.`
    );
  }
}

export function assertNotProductionScript(): void {
  if (isProduction() || isUsingProductionDatabase()) {
    throw new Error(
      `🚨 [PRODUCTION SCRIPT EXECUTION BLOCKED] Este script autónomo no puede ejecutarse en producción ni apuntando a la base de datos de producción.\n` +
      `   APP_ENV: ${process.env.APP_ENV || 'no configurado'}\n` +
      `   DATABASE_URL (parcial): ${maskDatabaseUrl(process.env.DATABASE_URL)}`
    );
  }
}
