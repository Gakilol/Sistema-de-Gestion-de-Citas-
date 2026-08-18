import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import {
  assertNonProductionE2ERuntime,
  assertSafeE2EDatabaseUrl,
  type E2EDatabaseIdentity,
} from './database-safety';

export interface IsolatedE2EEnvironment {
  baseURL: string;
  database: E2EDatabaseIdentity;
  port: number;
  webServerEnv: Record<string, string>;
}

export function configureIsolatedE2EEnvironment(): IsolatedE2EEnvironment {
  loadEnv({ path: resolve(process.cwd(), '.env'), quiet: true });
  loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true, quiet: true });
  const currentDatabaseUrl = process.env.DATABASE_URL;
  const applicationDatabaseUrl =
    process.env.APPLICATION_DATABASE_URL ||
    (currentDatabaseUrl && currentDatabaseUrl !== process.env.E2E_DATABASE_URL
      ? currentDatabaseUrl
      : undefined);
  loadEnv({
    path: resolve(process.cwd(), '.env.e2e.local'),
    override: true,
    quiet: true,
  });

  assertNonProductionE2ERuntime();
  const database = assertSafeE2EDatabaseUrl(
    process.env.E2E_DATABASE_URL,
    applicationDatabaseUrl
  );
  const e2eDatabaseUrl = process.env.E2E_DATABASE_URL as string;

  if (applicationDatabaseUrl) {
    process.env.APPLICATION_DATABASE_URL = applicationDatabaseUrl;
  }
  process.env.DATABASE_URL = e2eDatabaseUrl;
  process.env.TEST_RUN_ID ??= `e2e-${Date.now()}`;
  process.env.DISABLE_EMAILS = 'true';
  process.env.DISABLE_NOTIFICATIONS = 'true';
  process.env.DISABLE_REMINDER_JOBS = 'true';
  process.env.DISABLE_WHATSAPP = 'true';
  process.env.SEED_ADMIN_EMAIL = 'admin.e2e@sistema.test';
  process.env.SEED_ADMIN_PASSWORD = 'E2E-Only-Admin-Password-123!';

  const port = Number(process.env.E2E_PORT || 3100);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('E2E_PORT debe ser un puerto válido entre 1024 y 65535.');
  }

  return {
    baseURL: `http://127.0.0.1:${port}`,
    database,
    port,
    webServerEnv: {
      DATABASE_URL: e2eDatabaseUrl,
      JWT_SECRET: process.env.JWT_SECRET || '',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
      TEST_RUN_ID: process.env.TEST_RUN_ID,
      DISABLE_EMAILS: 'true',
      DISABLE_NOTIFICATIONS: 'true',
      DISABLE_REMINDER_JOBS: 'true',
      DISABLE_WHATSAPP: 'true',
      SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
    },
  };
}
