import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  use: {
    actionTimeout: 15000,
    baseURL: 'http://127.0.0.1:4329',
    viewport: { width: 1512, height: 982 },
    launchOptions: {
      executablePath: process.env.WDS_TEST_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node dist-server/index.js',
    url: 'http://127.0.0.1:4329/api/health',
    reuseExistingServer: false,
    timeout: 60000,
    env: { WDS_PORT: '4329', WDS_DATA_DIR: resolve('test-results', `workspace-${Date.now()}`), NODE_ENV: 'production' }
  }
});
