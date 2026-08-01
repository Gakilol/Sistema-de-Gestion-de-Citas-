import { defineConfig, devices } from '@playwright/test';
import { configureIsolatedE2EEnvironment } from './tests/e2e/environment';

const environment = configureIsolatedE2EEnvironment();

export default defineConfig({
  testDir: './tests',
  testMatch: '**/isolated-persistence.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: environment.baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'E2E aislado',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${environment.port}`,
    url: environment.baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: environment.webServerEnv,
  },
});
