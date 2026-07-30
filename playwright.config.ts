import { defineConfig } from '@playwright/test';

// Порт 4381 намеренно не совпадает с дефолтным 4321 astro dev: иначе запущенный dev-сервер
// с reuseExistingServer выдавал бы себя за стенд, и e2e гоняли бы несобранный dev-рендер,
// а /api/lead.php отдавался бы как статика.
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4381' },
  webServer: {
    command: 'php -S 127.0.0.1:4381 -t dist',
    url: 'http://127.0.0.1:4381',
    reuseExistingServer: !process.env.CI,
    env: {
      LEAD_CONFIG: `${process.cwd()}/tests/fixtures/lead-config.test.php`,
      // php -S однопоточный по умолчанию, а спеки бегут в несколько воркеров.
      PHP_CLI_SERVER_WORKERS: '4',
    },
  },
});
