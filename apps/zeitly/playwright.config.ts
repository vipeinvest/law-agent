import { defineConfig } from '@playwright/test';
const port = 3100;
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 390, height: 844 },
    locale: 'de-AT',
    timezoneId: 'Europe/Vienna',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'pnpm start:demo',
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { ZEITLY_DB: 'pglite', ZEITLY_DEMO: '1', SESSION_SECRET: 'e2e-secret-not-for-prod' },
  },
});
