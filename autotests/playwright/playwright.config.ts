import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const channel = process.env.PLAYWRIGHT_CHANNEL;
if (channel !== undefined && channel !== 'chrome') throw new Error('PLAYWRIGHT_CHANNEL supports only chrome.');

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    cwd: resolve(__dirname, '../..'),
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
