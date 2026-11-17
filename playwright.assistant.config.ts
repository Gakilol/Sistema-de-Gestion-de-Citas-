import { defineConfig, devices } from '@playwright/test';

// Completely mocked APIs and a dummy local database: this suite cannot write to Neon.
export default defineConfig({
  testDir: './tests', testMatch: 'assistant.mock.spec.ts', workers: 1, timeout: 45000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3108', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', screenshot: 'only-on-failure' },
  projects: [
    { name: 'Assistant desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'Assistant Android', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3108',
    url: 'http://127.0.0.1:3108/login', reuseExistingServer: false, timeout: 120000,
    env: { JWT_SECRET: 'assistant-browser-test-only-secret-32-characters', DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/assistant_test', NOVACITA_IA_ENABLED: 'true', GEMINI_API_KEY: '' },
  },
});
