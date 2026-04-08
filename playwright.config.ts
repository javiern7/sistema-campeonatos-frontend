import { defineConfig, devices } from '@playwright/test';

const frontendPort = Number(process.env.PLAYWRIGHT_FRONTEND_PORT ?? '4200');
const frontendBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: `npm run start -- --host localhost --port ${frontendPort}`,
    url: frontendBaseUrl,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120 * 1000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
