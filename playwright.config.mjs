import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
    locale: 'es-ES',
  },
  webServer: { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
