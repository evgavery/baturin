import type { APIRequestContext, APIResponse, Page } from '@playwright/test';

declare global {
  interface Window {
    /** Собранные на странице цели Метрики — заполняется только в тестах. */
    __goals?: string[];
  }
}

/**
 * Подписывается на событие `goal` до загрузки страницы и возвращает читалку списка целей.
 * Вызывать ДО `page.goto`.
 */
export async function collectGoals(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    window.__goals = [];
    document.addEventListener('goal', (event) => {
      window.__goals?.push((event as CustomEvent<string>).detail);
    });
  });
  return () => page.evaluate(() => window.__goals ?? []);
}

/** POST заявки на PHP-эндпоинт со своим IP — чтобы rate limit не путал тесты между собой. */
export function apiPost(
  request: APIRequestContext,
  body: unknown,
  ip: string,
): Promise<APIResponse> {
  return request.post('/api/lead.php', {
    headers: { Origin: 'http://127.0.0.1:4321', 'X-Test-IP': ip },
    data: body,
  });
}
