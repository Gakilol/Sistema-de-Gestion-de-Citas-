import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;
const jwtSecret = process.env.JWT_SECRET || 'visual-test-secret-with-at-least-32-characters';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.mock.spec.ts',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL, screenshot: 'only-on-failure' },
  projects: [
    { name: 'Desktop 1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'Mobile 390', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_URL: 'postgresql://visual:visual@127.0.0.1:5432/visual',
      JWT_SECRET: jwtSecret,
      JWT_REFRESH_SECRET: 'visual-refresh-secret-with-at-least-32-characters',
      DISABLE_EMAILS: 'true',
      DISABLE_NOTIFICATIONS: 'true',
    },
  },
});
