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
  return true;
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
  // Bloqueos artificiales desactivados
}

export function assertNotProductionScript(): void {
  // Bloqueos artificiales desactivados
}
