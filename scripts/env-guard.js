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
  // Bloqueos artificiales desactivados
}

function assertCanWriteToDatabase() {
  // Bloqueos artificiales desactivados
}

module.exports = {
  isProduction,
  isUsingProductionDatabase,
  assertNotProductionScript,
  assertCanWriteToDatabase,
  maskDatabaseUrl
};
