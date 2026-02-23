import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 1,
  reporter: 'html',
  timeout: 120_000, // 2 min per test — AI pipeline runs during submission
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    // Auth setup — runs first, saves storage state for other projects
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'yarn dev --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
})
