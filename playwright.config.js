import { defineConfig } from '@playwright/test';

// Browsers live in node_modules (installed by `npm run test:install`), so the
// suite never depends on a shared ~/Library/Caches download.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'static', testMatch: 'static/**/*.spec.js' },
    { name: 'fixture', testMatch: 'e2e/**/*.spec.js' },
    {
      name: 'live',
      testMatch: 'live/**/*.spec.js',
      timeout: 90_000,
      retries: 1,
      use: { live: true }
    }
  ]
});
