import { defineConfig, devices } from '@playwright/test';

// Not the serve-site default (4173), which is a common dev-server port.
const PORT = 4180;

export default defineConfig({
  testDir: 'tests/e2e',
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  globalTimeout: 180_000,
  expect: { timeout: 5_000 },
  use: { baseURL: `http://127.0.0.1:${PORT}/` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/serve-site.mjs',
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
