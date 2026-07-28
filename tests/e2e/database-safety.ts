const SAFE_DATABASE_NAME = /(^|[-_])(e2e|test)([-_]|$)/i;
const PRODUCTION_VALUES = new Set(['production', 'prod']);

export interface E2EDatabaseIdentity {
  host: string;
  port: string;
  database: string;
}

type E2ERuntimeEnvironment = {
  NODE_ENV?: string;
  APP_ENV?: string;
  VERCEL_ENV?: string;
};

export function getE2EDatabaseIdentity(databaseUrl: string): E2EDatabaseIdentity {
  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('E2E_DATABASE_URL no es una URL válida.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('E2E_DATABASE_URL debe usar PostgreSQL.');
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')).trim();
  if (!database) {
    throw new Error('E2E_DATABASE_URL debe indicar el nombre de la base.');
  }

  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || '5432',
    database,
  };
}

export function assertSafeE2EDatabaseUrl(
  e2eDatabaseUrl: string | undefined,
  applicationDatabaseUrl?: string
): E2EDatabaseIdentity {
  if (!e2eDatabaseUrl) {
    throw new Error(
      'Falta E2E_DATABASE_URL. Crea .env.e2e.local a partir de .env.e2e.example.'
    );
  }

  const identity = getE2EDatabaseIdentity(e2eDatabaseUrl);
  if (applicationDatabaseUrl) {
    const applicationIdentity = getE2EDatabaseIdentity(applicationDatabaseUrl);
    const sameDatabase =
      identity.host === applicationIdentity.host &&
      identity.port === applicationIdentity.port &&
      identity.database.toLowerCase() === applicationIdentity.database.toLowerCase();

    if (e2eDatabaseUrl === applicationDatabaseUrl || sameDatabase) {
      throw new Error('E2E_DATABASE_URL no puede coincidir con DATABASE_URL.');
    }
  }

  if (!SAFE_DATABASE_NAME.test(identity.database)) {
    throw new Error(
      `La base E2E debe incluir "e2e" o "test" en su nombre; se recibió "${identity.database}".`
    );
  }

  return identity;
}

export function assertNonProductionE2ERuntime(
  environment: E2ERuntimeEnvironment = process.env
) {
  const productionSignal = [
    environment.NODE_ENV,
    environment.APP_ENV,
    environment.VERCEL_ENV,
  ].find((value) => value && PRODUCTION_VALUES.has(value.toLowerCase()));

  if (productionSignal) {
    throw new Error('La suite E2E aislada no puede ejecutarse con señales de producción.');
  }
}
