import { expect, test } from '@playwright/test';
import { SITE } from '../../src/config/site';
import { FAQ_LED } from '../../src/data/faq';
import { collectGoals, plain, readJsonLd, rub } from './helpers';

const PAGE = '/led-ekrany/';

// Ожидаемые суммы посчитаны от ставки ТЗ §8.1 (3 500 ₽/м², зафиксирована в data.test.ts):
// 4×2,5 = 35 000 ₽, 3×2,5 = 26 500 ₽, 1×2,5 = 9 000 ₽, 20×2,5 = 175 000 ₽,
// типовые конфигурации — 21 000 / 35 000 / 63 000 ₽. Сменится ставка — числа пересматриваем.
const M2 = SITE.prices.ledM2;

test.describe('/led-ekrany/', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
  });

  test('H1 из ТЗ §5.3, мета под кластер LED и хлебные крошки', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Аренда светодиодных экранов');

    // Шаблон title из ТЗ §9; в 60 знаков укладывается title целиком, вместе с брендом.
    const title = plain(await page.title());
    expect(title).toContain(`Аренда LED-экранов в Москве — от ${plain(rub(M2))}/м²`);
    expect(title).toContain(SITE.brandName);
    expect(title.length).toBeLessThanOrEqual(60);

    const description =
      (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    expect(description.length).toBeLessThanOrEqual(160);
    expect(plain(description)).toContain(plain(rub(M2)));
    expect(plain(description)).toContain('30 минут');

    const crumbs = page.locator('nav[aria-label="Хлебные крошки"]');
    await expect(crumbs.locator('a[href="/"]')).toBeVisible();
    await expect(crumbs).toContainText('LED-экраны');
  });

  test('калькулятор: границы полей и расчёт по умолчанию 4×2,5 м с дистанции 5 м', async ({
    page,
  }) => {
    const calc = page.locator('#led-calc');

    const bounds = [
      { name: 'w', min: '1', max: '20', step: '0.5', value: '4' },
      { name: 'h', min: '1', max: '10', step: '0.5', value: '2.5' },
      { name: 'dist', min: '2', max: '30', step: '1', value: '5' },
    ];
    for (const field of bounds) {
      const input = calc.locator(`input[name="${field.name}"]`);
      await expect(input).toHaveValue(field.value);
      await expect(input).toHaveAttribute('min', field.min);
      await expect(input).toHaveAttribute('max', field.max);
      await expect(input).toHaveAttribute('step', field.step);
      // Мобильная клавиатура: цифры, а не буквы.
      await expect(input).toHaveAttribute('inputmode', /decimal|numeric/);
    }

    await expect(calc.locator('[data-out="area"]')).toHaveText('10 м²');
    await expect(calc.locator('[data-out="pitch"]')).toHaveText('P4');
    await expect(calc.locator('[data-out="price"]')).toHaveText(`от ${rub(35000)}`);
    await expect(calc).toContainText('Точную смету пришлём в мессенджер за 30 минут');
  });

  test('пересчёт при вводе: ширина 3 м, затем дистанция 3 м и 2 м', async ({ page }) => {
    const calc = page.locator('#led-calc');

    await calc.locator('input[name="w"]').fill('3');
    await expect(calc.locator('[data-out="area"]')).toHaveText('7,5 м²');
    await expect(calc.locator('[data-out="price"]')).toHaveText(`от ${rub(26500)}`);

    await calc.locator('input[name="dist"]').fill('3');
    await expect(calc.locator('[data-out="pitch"]')).toHaveText('P3');

    await calc.locator('input[name="dist"]').fill('2');
    await expect(calc.locator('[data-out="pitch"]')).toHaveText('P2.5');
  });

  test('пустое и запредельное значение считаются по границам поля, NaN в выводе нет', async ({
    page,
  }) => {
    const calc = page.locator('#led-calc');
    const width = calc.locator('input[name="w"]');

    // Пустое поле — и буквы, которые number-инпут просто не принимает, — это минимум поля: 1 м.
    await width.fill('');
    await expect(calc.locator('[data-out="area"]')).toHaveText('2,5 м²');
    await expect(calc.locator('[data-out="price"]')).toHaveText(`от ${rub(9000)}`);

    // Больше максимума — считаем по максимуму: 20 м.
    await width.fill('999');
    await expect(calc.locator('[data-out="area"]')).toHaveText('50 м²');
    await expect(calc.locator('[data-out="price"]')).toHaveText(`от ${rub(175000)}`);

    await calc.locator('input[name="dist"]').fill('');
    await expect(calc.locator('[data-out="pitch"]')).toHaveText('P2.5');

    await expect(calc).not.toContainText('NaN');
  });

  test('кнопка «Получить точную смету» уносит размеры экрана в квиз', async ({ page }) => {
    const button = page.locator('#led-calc button[data-quiz-open]');
    await expect(button).toBeVisible();
    expect(JSON.parse((await button.getAttribute('data-preset')) ?? 'null')).toEqual({
      services: ['led'],
      ledW: 4,
      ledH: 2.5,
    });

    await page.locator('#led-calc input[name="w"]').fill('3');
    await expect(button).toHaveAttribute('data-preset', /"ledW":3,/);
    expect(JSON.parse((await button.getAttribute('data-preset')) ?? 'null')).toEqual({
      services: ['led'],
      ledW: 3,
      ledH: 2.5,
    });
  });

  test('объяснение форматов: кабинеты, площадь в м², indoor/outdoor и шаг пикселя', async ({
    page,
  }) => {
    const formats = page.locator('#formats');

    await expect(formats).toContainText('кабинет');
    await expect(formats).toContainText('м²');
    await expect(formats).toContainText(/indoor/i);
    await expect(formats).toContainText(/outdoor/i);
    await expect(formats).toContainText('шаг пиксел');
    await expect(formats).toContainText('P2.5');
    await expect(formats).toContainText('P4');
  });

  test('три типовые конфигурации с ценой от ставки за м²', async ({ page }) => {
    const configs = page.locator('#configs [data-config]');
    await expect(configs).toHaveCount(3);

    const expected = [
      { size: '3 × 2 м', price: rub(21000), area: '6 м²' },
      { size: '4 × 2,5 м', price: rub(35000), area: '10 м²' },
      { size: '6 × 3 м', price: rub(63000), area: '18 м²' },
    ];
    for (const [index, item] of expected.entries()) {
      const card = configs.nth(index);
      await expect(card).toContainText(item.size);
      await expect(card).toContainText(item.area);
      await expect(card).toContainText(`от ${item.price}`);
    }

    // Задник сцены — третья конфигурация из ТЗ §5.3.
    await expect(configs.nth(2)).toContainText('адник');
  });

  test('флагман, что включено, FAQ направления, CTA и полезный текст', async ({ page }) => {
    await expect(page.locator('#flagship')).toContainText(SITE.flagship.name);

    const included = page.locator('#included');
    await expect(included).toContainText(/ферм/i);
    await expect(included).toContainText(/видеопроцессор/i);
    await expect(included).toContainText(/контент/i);
    await expect(included).toContainText(/техник/i);

    await expect(page.locator('#faq details')).toHaveCount(FAQ_LED.length);
    const faq = (await readJsonLd(page)).find((node) => node['@type'] === 'FAQPage');
    if (!faq) throw new Error('На странице нет разметки FAQPage');
    expect((faq.mainEntity as { name: string }[]).map((question) => question.name)).toEqual(
      FAQ_LED.map((item) => item.q),
    );

    await expect(page.locator('#cta button[data-quiz-open]')).toBeVisible();

    // Страница направления: полезного текста не меньше, чем требует ТЗ §9.
    const text = await page.locator('[data-seo-text]').innerText();
    expect(text.length).toBeGreaterThanOrEqual(1500);

    // Перелинковка: соседнее направление для тех, кому хватит одной панели.
    await expect(page.locator('main a[href="/plazmy/"]').first()).toBeVisible();
  });
});

test('цель calc_use уходит один раз за сессию, а не на каждое изменение', async ({ page }) => {
  const goals = await collectGoals(page);
  await page.goto(PAGE);

  const calc = page.locator('#led-calc');
  await calc.locator('input[name="w"]').fill('3');
  await calc.locator('input[name="dist"]').fill('3');

  await expect.poll(goals).toContain('calc_use');
  expect((await goals()).filter((goal) => goal === 'calc_use')).toHaveLength(1);

  // Флаг живёт в sessionStorage: после перезагрузки цель повторно не уходит.
  await page.reload();
  await calc.locator('input[name="w"]').fill('5');
  await expect(calc.locator('[data-out="area"]')).toHaveText('12,5 м²');
  expect(await goals()).not.toContain('calc_use');
});
