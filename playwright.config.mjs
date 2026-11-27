import { defineConfig } from '@playwright/test';

// PORT permite probar sin chocar con otro `npm run dev` abierto (se reutilizaría y probaría otro código).
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
    locale: 'es-ES',
  },
  webServer: { command: 'node scripts/serve.mjs', url: `http://127.0.0.1:${port}`, reuseExistingServer: true, env: { PORT: String(port) } },
});
