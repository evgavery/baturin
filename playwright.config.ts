import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4321' },
  webServer: {
    command: 'php -S 127.0.0.1:4321 -t dist',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    env: { LEAD_CONFIG: `${process.cwd()}/tests/fixtures/lead-config.test.php` },
  },
});
