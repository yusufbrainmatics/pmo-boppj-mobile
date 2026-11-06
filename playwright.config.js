import { defineConfig } from '@playwright/test'

const base = process.env.BASE || '/pmo-boppj-mobile/'
const origin = process.env.E2E_REMOTE || 'http://127.0.0.1:4388'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `${origin}${base}`,
    browserName: 'chromium',
    timezoneId: 'Asia/Jakarta',
    locale: 'id-ID',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CH ? { executablePath: process.env.CH } : {},
  },
  webServer: process.env.E2E_REMOTE ? undefined : {
    command: `pnpm build:pages && pnpm exec vite preview --base /pmo-boppj-mobile/ --host 127.0.0.1 --port 4388 --strictPort`,
    url: `${origin}${base}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
})
