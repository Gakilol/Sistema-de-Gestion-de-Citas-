import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'tests/e2e/**/*'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
