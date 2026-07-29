import { expect, test } from '@playwright/test';
import { SITE } from '../../src/config/site';
import { DIAGONALS } from '../../src/data/diagonals';
import { FAQ_PLASMA } from '../../src/data/faq';
import { plain, readJsonLd, requireNode, rub } from './helpers';

const HUB = '/plazmy/';
const pageUrl = (size: string): string => `/plazmy/${size}/`;
const absolute = (path: string): string => new URL(path, SITE.url).href;

test.describe('хаб /plazmy/', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HUB);
  });

  test('один H1 под кластер и интро про деловые сценарии', async ({ page }) => {
    const h1 = page.locator('h1');

    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Аренда плазменных и ЖК-панелей в Москве');

    // Интро направления по ТЗ §5.2 — деловые сценарии, а не «праздник».
    const hero = page.locator('#hero');
    for (const scenario of ['конференц', 'выстав', 'стенд', 'презентац']) {
      await expect(hero).toContainText(scenario);
    }
  });

  test('четыре карточки-экрана и ссылки на страницы диагоналей', async ({ page }) => {
    await expect(page.locator('[data-screen-card]')).toHaveCount(4);

    for (const diagonal of DIAGONALS) {
      await expect(page.locator(`[data-screen-card="${diagonal.size}"]`)).toBeVisible();
      await expect(page.locator(`main a[href="${pageUrl(diagonal.size)}"]`).first()).toBeVisible();
    }
  });

  test('таблица цен: строка на диагональ с ценами 1/2/3 дня из конфига', async ({ page }) => {
    const rows = page.locator('#prices table tbody tr');
    await expect(rows).toHaveCount(4);

    for (const diagonal of DIAGONALS) {
      const row = rows.filter({ hasText: `${diagonal.size}″` });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(rub(diagonal.prices.d1));
      await expect(row).toContainText(rub(diagonal.prices.d2));
      await expect(row).toContainText(rub(diagonal.prices.d3));
    }
  });

  test('«другие диагонали по запросу» открывают квиз с пресетом консультации', async ({ page }) => {
    const block = page.locator('#other-diagonals');

    await expect(block).toContainText('32–50');
    await expect(block).toContainText('65');
    await expect(block).toContainText('100');

    const button = block.locator('button[data-quiz-open]');
    await expect(button).toBeVisible();
    const preset = await button.getAttribute('data-preset');
    expect(JSON.parse(preset ?? 'null')).toEqual({ services: ['consult'] });
  });

  test('три способа установки: у каждого схема и подпись', async ({ page }) => {
    await expect(page.locator('[data-mount]')).toHaveCount(3);
    await expect(page.locator('[data-mount] svg')).toHaveCount(3);

    for (const name of ['Напольная стойка', 'Настенный кронштейн', 'Настольная установка']) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }
  });

  test('технические детали, полезный текст, FAQ направления и CTA', async ({ page }) => {
    await expect(page.locator('#tech')).toContainText('HDMI');
    await expect(page.locator('#tech')).toContainText('флешк');
    await expect(page.locator('#tech')).toContainText('Zoom');

    // Хаб — страница направления: полезного текста на ней не меньше, чем требует ТЗ §9.
    const text = await page.locator('[data-seo-text]').innerText();
    expect(text.length).toBeGreaterThanOrEqual(1500);

    await expect(page.locator('#faq details')).toHaveCount(FAQ_PLASMA.length);
    await expect(page.locator('#cta button[data-quiz-open]')).toBeVisible();
  });
});

for (const diagonal of DIAGONALS) {
  const { size } = diagonal;
  const others = DIAGONALS.filter((item) => item.size !== size);

  test.describe(`страница /plazmy/${size}/`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(pageUrl(size));
    });

    test('H1 и мета под кластер диагонали, длины в лимитах выдачи', async ({ page }) => {
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(`Аренда панели ${size} дюймов в Москве`);

      const title = await page.title();
      expect(title.length).toBeLessThanOrEqual(60);
      expect(plain(title)).toContain(`Аренда панели ${size} дюймов в Москве`);
      expect(plain(title)).toContain(plain(rub(diagonal.prices.d1)));
      expect(plain(title)).toContain(SITE.brandName);

      const description =
        (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
      expect(description.length).toBeLessThanOrEqual(160);
      expect(plain(description)).toContain(plain(rub(diagonal.prices.d1)));
      expect(plain(description)).toContain('30 минут');
    });

    test('карточка-экран своей диагонали, цены 1/2/3 дня и состав аренды', async ({ page }) => {
      const cards = page.locator('[data-screen-card]');
      await expect(cards).toHaveCount(1);
      await expect(page.locator(`[data-screen-card="${size}"]`)).toContainText(
        `${diagonal.widthCm}`,
      );

      const rows = page.locator('#prices table tbody tr');
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText(rub(diagonal.prices.d1));
      await expect(rows).toContainText(rub(diagonal.prices.d2));
      await expect(rows).toContainText(rub(diagonal.prices.d3));

      for (const item of SITE.included) {
        await expect(page.locator('#included')).toContainText(item);
      }

      await expect(page.locator('[data-mount]')).toHaveCount(3);
    });

    test('уникальный текст 1000–1500 знаков с фразами кластера по одному разу', async ({ page }) => {
      const text = plain(await page.locator('[data-seo-text]').innerText());

      expect(text.length).toBeGreaterThanOrEqual(1000);
      expect(text.length).toBeLessThanOrEqual(1500);

      const phrases = [
        `аренда телевизора ${size} дюймов`,
        `аренда панели ${size} дюймов на мероприятие`,
        `прокат экрана ${size}″`,
      ];
      const lower = text.toLowerCase();
      for (const phrase of phrases) {
        expect(lower.split(phrase).length - 1, `фраза «${phrase}»`).toBe(1);
      }
    });

    test('микроразметка: хлебные крошки, товар с ценой страницы и FAQ', async ({ page }) => {
      const nodes = await readJsonLd(page);

      const breadcrumbs = requireNode(nodes, 'BreadcrumbList');
      const items = breadcrumbs.itemListElement as {
        position: number;
        name: string;
        item: string;
      }[];
      expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
      expect(items.map((item) => item.name)).toEqual(['Главная', 'Плазменные панели', `${size}″`]);
      expect(items.map((item) => item.item)).toEqual([
        absolute('/'),
        absolute(HUB),
        absolute(pageUrl(size)),
      ]);

      const product = requireNode(nodes, 'Product');
      expect(String(product.name)).toContain(size);
      expect(product.url).toBe(absolute(pageUrl(size)));
      const offer = product.offers as { price: number; priceCurrency: string };
      expect(offer.price).toBe(diagonal.prices.d1);
      expect(offer.priceCurrency).toBe('RUB');

      const faq = requireNode(nodes, 'FAQPage');
      const questions = faq.mainEntity as { name: string }[];
      expect(questions.map((question) => question.name)).toEqual(
        diagonal.faq.map((item) => item.q),
      );
    });

    test('перелинковка: три соседние диагонали и хаб направления', async ({ page }) => {
      for (const other of others) {
        await expect(page.locator(`main a[href="${pageUrl(other.size)}"]`).first()).toBeVisible();
      }
      await expect(page.locator(`main a[href="${HUB}"]`).first()).toBeVisible();
    });

    test('FAQ диагонали и CTA с пресетом своей позиции', async ({ page }) => {
      const items = page.locator('#faq details');
      await expect(items).toHaveCount(diagonal.faq.length);
      for (const [index, item] of diagonal.faq.entries()) {
        await expect(items.nth(index).locator('summary')).toHaveText(item.q);
      }

      const cta = page.locator('#cta button[data-quiz-open]');
      const preset = await cta.getAttribute('data-preset');
      expect(JSON.parse(preset ?? 'null')).toEqual({ services: ['plasma'], diagonals: [size] });
    });
  });
}

test('титулы хаба и четырёх диагоналей уникальны', async ({ page }) => {
  const titles = new Set<string>();

  for (const path of [HUB, ...DIAGONALS.map((diagonal) => pageUrl(diagonal.size))]) {
    await page.goto(path);
    titles.add(await page.title());
  }

  expect(titles.size).toBe(5);
});
