import { expect, test, type Page } from '@playwright/test';
import { SITE } from '../../src/config/site';
import { FAQ_STREAM, FAQ_TOUCH } from '../../src/data/faq';

// Задача 7: /touch-paneli/ (железо, карточки позиций) и /videotranslyacii/ (услуга,
// структура другая — состав/пакеты/процесс). Задача 8 дописывает вторую часть файла.

/** Цена так, как её печатает сайт: разряды и пробел перед ₽ — неразрывные (конвенция №4). */
const rub = (value: number): string => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;

/** Сырые строки (title, meta) веб-ассерты не нормализуют — сравниваем без NBSP. */
const plain = (value: string): string => value.replace(/ /g, ' ');

interface JsonLdNode {
  '@type': string;
  [key: string]: unknown;
}

async function readJsonLd(page: Page): Promise<JsonLdNode[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((block) => JSON.parse(block) as JsonLdNode);
}

function requireNode(nodes: JsonLdNode[], type: string): JsonLdNode {
  const node = nodes.find((item) => item['@type'] === type);
  if (!node) throw new Error(`На странице нет разметки ${type}`);
  return node;
}

test.describe('/touch-paneli/', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/touch-paneli/');
  });

  test('H1, title в лимите и хлебные крошки', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Аренда сенсорных панелей и интерактивных киосков');

    const title = plain(await page.title());
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain(plain(rub(SITE.prices.touch)));
    expect(title).toContain(SITE.brandName);

    const description =
      (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    expect(description.length).toBeLessThanOrEqual(160);
    expect(plain(description)).toContain(plain(rub(SITE.prices.touch)));

    const crumbs = page.locator('nav[aria-label="Хлебные крошки"]');
    await expect(crumbs.locator('a[href="/"]')).toBeVisible();
    await expect(crumbs).toContainText('Тач-панели');
  });

  test('три позиции из touchTable с ценами', async ({ page }) => {
    const cards = page.locator('[data-position]');
    await expect(cards).toHaveCount(SITE.prices.touchTable.length);

    for (const row of SITE.prices.touchTable) {
      const card = cards.filter({ hasText: row.label });
      await expect(card).toHaveCount(1);
      await expect(card).toContainText(rub(row.d1));
    }
  });

  test('сценарии использования: стенды, регистрация, презентации, навигация', async ({
    page,
  }) => {
    const scenarios = page.locator('#scenarios');
    for (const phrase of ['стенд', 'регистрац', 'презентац', 'навигац']) {
      await expect(scenarios).toContainText(new RegExp(phrase, 'i'));
    }
  });

  test('загрузка контента заказчика и помощь с настройкой', async ({ page }) => {
    const content = page.locator('#content');
    await expect(content).toContainText(/контент/i);
    await expect(content).toContainText(/настро/i);
  });

  test('FAQ, хлебные крошки и товары в JSON-LD; CTA с пресетом touch', async ({ page }) => {
    const nodes = await readJsonLd(page);

    const breadcrumbs = requireNode(nodes, 'BreadcrumbList');
    const crumbItems = breadcrumbs.itemListElement as { name: string }[];
    expect(crumbItems.map((item) => item.name)).toEqual(['Главная', 'Тач-панели']);

    const faq = requireNode(nodes, 'FAQPage');
    const questions = faq.mainEntity as { name: string }[];
    expect(questions.map((question) => question.name)).toEqual(FAQ_TOUCH.map((item) => item.q));
    await expect(page.locator('#faq details')).toHaveCount(FAQ_TOUCH.length);

    const products = nodes.filter((node) => node['@type'] === 'Product');
    expect(products.length).toBe(SITE.prices.touchTable.length);
    for (const row of SITE.prices.touchTable) {
      const product = products.find((item) => item.name === row.label);
      expect(product, `товар «${row.label}» в JSON-LD`).toBeDefined();
      const offer = product?.offers as { price: number; priceCurrency: string };
      expect(offer.price).toBe(row.d1);
      expect(offer.priceCurrency).toBe('RUB');
    }

    const cta = page.locator('#cta button[data-quiz-open]');
    await expect(cta).toBeVisible();
    expect(JSON.parse((await cta.getAttribute('data-preset')) ?? 'null')).toEqual({
      services: ['touch'],
    });
  });

  test('полезный текст не короче 1500 знаков', async ({ page }) => {
    const text = await page.locator('[data-seo-text]').innerText();
    expect(text.length).toBeGreaterThanOrEqual(1500);
  });
});

test.describe('/videotranslyacii/', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/videotranslyacii/');
  });

  test('H1, title в лимите и хлебные крошки', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Видеотрансляции мероприятий');

    const title = plain(await page.title());
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain(plain(rub(SITE.prices.stream)));
    expect(title).toContain(SITE.brandName);

    const description =
      (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    expect(description.length).toBeLessThanOrEqual(160);
    expect(plain(description)).toContain(plain(rub(SITE.prices.stream)));

    const crumbs = page.locator('nav[aria-label="Хлебные крошки"]');
    await expect(crumbs.locator('a[href="/"]')).toBeVisible();
    await expect(crumbs).toContainText('Видеотрансляции');
  });

  test('три пакета из streamTable с ценами', async ({ page }) => {
    const cards = page.locator('[data-package]');
    await expect(cards).toHaveCount(SITE.prices.streamTable.length);

    for (const row of SITE.prices.streamTable) {
      const card = cards.filter({ hasText: row.label });
      await expect(card).toHaveCount(1);
      await expect(card).toContainText(rub(row.d1));
    }
  });

  test('состав услуги: камеры, режиссёр, вывод в VK Видео и закрытый Zoom, запись', async ({
    page,
  }) => {
    const composition = page.locator('#composition');
    await expect(composition).toContainText(/камер/i);
    await expect(composition).toContainText(/режиссёр/i);
    await expect(composition).toContainText(/экраны площадки/i);
    await expect(composition).toContainText(/сайт/i);
    await expect(composition).toContainText('VK Видео');
    await expect(composition).toContainText('Telegram');
    await expect(composition).toContainText('Zoom');
    await expect(composition).toContainText(/запис/i);
  });

  test('блок процесса: бриф, техплан, трансляция, запись', async ({ page }) => {
    const process = page.locator('#process');
    await expect(process).toContainText(/бриф/i);
    await expect(process).toContainText(/техническ/i);
    await expect(process).toContainText(/трансляц/i);
    await expect(process).toContainText(/запис/i);
  });

  test('FAQ, хлебные крошки и пакеты в JSON-LD; CTA с пресетом stream', async ({ page }) => {
    const nodes = await readJsonLd(page);

    const breadcrumbs = requireNode(nodes, 'BreadcrumbList');
    const crumbItems = breadcrumbs.itemListElement as { name: string }[];
    expect(crumbItems.map((item) => item.name)).toEqual(['Главная', 'Видеотрансляции']);

    const faq = requireNode(nodes, 'FAQPage');
    const questions = faq.mainEntity as { name: string }[];
    expect(questions.map((question) => question.name)).toEqual(FAQ_STREAM.map((item) => item.q));
    await expect(page.locator('#faq details')).toHaveCount(FAQ_STREAM.length);

    const products = nodes.filter((node) => node['@type'] === 'Product');
    expect(products.length).toBe(SITE.prices.streamTable.length);
    for (const row of SITE.prices.streamTable) {
      const product = products.find((item) => item.name === row.label);
      expect(product, `пакет «${row.label}» в JSON-LD`).toBeDefined();
      const offer = product?.offers as { price: number; priceCurrency: string };
      expect(offer.price).toBe(row.d1);
      expect(offer.priceCurrency).toBe('RUB');
    }

    const cta = page.locator('#cta button[data-quiz-open]');
    await expect(cta).toBeVisible();
    expect(JSON.parse((await cta.getAttribute('data-preset')) ?? 'null')).toEqual({
      services: ['stream'],
    });
  });

  test('полезный текст не короче 1500 знаков', async ({ page }) => {
    const text = await page.locator('[data-seo-text]').innerText();
    expect(text.length).toBeGreaterThanOrEqual(1500);
  });
});

test('титулы тач-панелей и видеотрансляций уникальны', async ({ page }) => {
  const titles = new Set<string>();
  for (const path of ['/touch-paneli/', '/videotranslyacii/']) {
    await page.goto(path);
    titles.add(await page.title());
  }
  expect(titles.size).toBe(2);
});
