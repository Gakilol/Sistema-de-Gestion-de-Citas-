function isProduction() {
  return process.env.APP_ENV === 'production';
}

function isUsingProductionDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.includes('ep-odd-base-aj140b7z');
}

function maskDatabaseUrl(url) {
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

function assertNotProductionScript() {
  if (isProduction() || isUsingProductionDatabase()) {
    throw new Error(
      `🚨 [PRODUCTION SCRIPT EXECUTION BLOCKED] Este script autónomo no puede ejecutarse en producción o apuntando a la base de datos de producción.\n` +
      `   APP_ENV: ${process.env.APP_ENV || 'no configurado'}\n` +
      `   DATABASE_URL (parcial): ${maskDatabaseUrl(process.env.DATABASE_URL)}`
    );
  }
}

function assertCanWriteToDatabase() {
  if (isUsingProductionDatabase() && !isProduction()) {
    throw new Error(
      `🚨 [DATABASE WRITE BLOCKED] Se intentó realizar una escritura desde script local apuntando a base de datos de producción.\n` +
      `   DATABASE_URL (parcial): ${maskDatabaseUrl(process.env.DATABASE_URL)}`
    );
  }
  if (process.env.ALLOW_DB_WRITES !== 'true') {
    throw new Error(
      `🚨 [DATABASE WRITE BLOCKED] Escrituras deshabilitadas para este script (ALLOW_DB_WRITES no es true).`
    );
  }
}

module.exports = {
  isProduction,
  isUsingProductionDatabase,
  assertNotProductionScript,
  assertCanWriteToDatabase,
  maskDatabaseUrl
};
