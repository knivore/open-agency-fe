import { defineConfig } from '@playwright/test';

const frontendBaseUrl = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: frontendBaseUrl,
    headless: true,
  },
});
