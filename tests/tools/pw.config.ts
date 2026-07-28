import { defineConfig } from '@playwright/test';

// Мини-конфиг для ручных инструментов (генерация og-image), вне основного testDir.
// Запуск: npx playwright test --config=tests/tools/pw.config.ts
export default defineConfig({ testDir: '.' });
