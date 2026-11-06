import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Mobile 360px',
      use: {
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Tablet 768px',
      use: {
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'Desktop 1280px',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:server',
      port: 4000,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev:client',
      port: 5173,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});

