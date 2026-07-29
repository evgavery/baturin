import type { APIRequestContext, APIResponse, Page } from '@playwright/test';

declare global {
  interface Window {
    /** Собранные на странице цели Метрики — заполняется только в тестах. */
    __goals?: string[];
  }
}

/** Цена так, как её печатает сайт: разряды и пробел перед ₽ — неразрывные (конвенция №4). */
export const rub = (value: number): string => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;

/** Сырые строки (title, meta, innerText) веб-ассерты не нормализуют — сравниваем без NBSP. */
export const plain = (value: string): string => value.replace(/\u00A0/g, ' ');

export interface JsonLdNode {
  '@type': string;
  [key: string]: unknown;
}

/** Читает все блоки `application/ld+json` со страницы как разобранные объекты. */
export async function readJsonLd(page: Page): Promise<JsonLdNode[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((block) => JSON.parse(block) as JsonLdNode);
}

/** Находит узел JSON-LD по `@type`; бросает читаемую ошибку, если разметки нет. */
export function requireNode(nodes: JsonLdNode[], type: string): JsonLdNode {
  const node = nodes.find((item) => item['@type'] === type);
  if (!node) throw new Error(`На странице нет разметки ${type}`);
  return node;
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
