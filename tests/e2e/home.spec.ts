import { expect, test } from '@playwright/test';
import { SITE } from '../../src/config/site';
import { DIAGONALS } from '../../src/data/diagonals';
import { FAQ_HOME } from '../../src/data/faq';
import { DIRECTION_LINKS } from '../../src/data/nav';
import { plain, readJsonLd, requireNode, rub } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('на главной один H1 с точным заголовком, и он вне слайдов', async ({ page }) => {
  const h1 = page.locator('h1');

  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText('Аренда экранов для мероприятий в Москве');
  await expect(page.locator('[data-slide] h1')).toHaveCount(0);
});

// Лимиты выдачи ТЗ §9: title ≤60, description ≤160 — длиннее обрезается в выдаче.
test('title и description главной укладываются в лимиты выдачи (ТЗ §9)', async ({ page }) => {
  const title = plain(await page.title());
  expect(title.length).toBeLessThanOrEqual(60);
  expect(title).toContain('Аренда экранов для мероприятий в Москве');
  expect(title).toContain(SITE.brandName);

  const description =
    (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
  expect(description.length).toBeLessThanOrEqual(160);
  expect(plain(description)).toContain(plain(rub(SITE.prices.ledM2)));
  expect(plain(description)).toContain('Москве');
  expect(plain(description)).toContain('30 минут');
});

test('hero: кнопка сметы открывает квиз, тихий звонок ведёт на номер из конфига', async ({
  page,
}) => {
  const hero = page.locator('#hero');

  await expect(hero.locator('button[data-quiz-open]')).toHaveCount(1);

  const phone = hero.locator('a[data-goal="click_phone"]');
  await expect(phone).toHaveCount(1);
  await expect(phone).toHaveAttribute('href', SITE.phoneHref);
});

test('слайдер парка: три слайда с цифрами из конфига, точка переключает слайд', async ({
  page,
}) => {
  const slider = page.locator('section[aria-roledescription="carousel"]');
  await expect(slider).toBeVisible();

  const slides = slider.locator('[data-slide]');
  await expect(slides).toHaveCount(3);
  await expect(slides.nth(0)).toContainText(String(SITE.park.ledTotalM2));
  await expect(slides.nth(1)).toContainText(String(SITE.park.plasmaUnits));
  await expect(slides.locator('h2')).toHaveCount(3);

  const dots = slider.locator('[data-dot]');
  await expect(dots).toHaveCount(3);
  await dots.nth(1).click();
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
});

test('форма подбора: селекты, непредотмеченное согласие, скрытая ловушка и сноска агентствам', async ({
  page,
}) => {
  const form = page.locator('#qualify-form');
  await expect(form).toBeVisible();

  await expect(form.locator('select[name="interest"] option')).toHaveCount(5);
  const clientTypeValues = await form
    .locator('select[name="client_type"] option')
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
    );
  expect(clientTypeValues).toEqual(['agency', 'organizer', 'company', 'other']);

  await expect(form.locator('input[name="channel"]')).toHaveCount(5);
  await expect(form.locator('input[name="consent"]')).not.toBeChecked();

  const honeypot = form.locator('input[name="website"]');
  await expect(honeypot).toBeHidden();
  await expect(honeypot).toHaveAttribute('tabindex', '-1');

  await expect(page.locator('#podbor a[href="/agentstvam/"]')).toBeVisible();
});

test('четыре карточки направлений ведут на страницы разделов', async ({ page }) => {
  await expect(page.locator('#directions a')).toHaveCount(4);
  for (const link of DIRECTION_LINKS) {
    await expect(page.locator(`#directions a[href="${link.href}"]`)).toBeVisible();
  }
});

test('карточки-экраны: диагональ, габариты, цена и пресет квиза', async ({ page }) => {
  await expect(page.locator('[data-screen-card]')).toHaveCount(4);

  for (const diagonal of DIAGONALS) {
    const card = page.locator(`[data-screen-card="${diagonal.size}"]`);
    await expect(card).toContainText(`${diagonal.size}″`);
    await expect(card).toContainText(`${diagonal.widthCm}`);
    await expect(card).toContainText(`${diagonal.heightCm}`);
    await expect(card).toContainText(`от ${rub(diagonal.prices.d1)}`);
  }

  // Неразрывные пробелы проверяем по сырому тексту: веб-ассерты их нормализуют.
  const rawPrice = await page.locator('[data-screen-card="55"] [data-price]').textContent();
  expect(rawPrice).toContain('3 500 ₽');

  const preset = await page
    .locator('[data-screen-card="55"] button[data-quiz-open]')
    .getAttribute('data-preset');
  expect(JSON.parse(preset ?? 'null')).toEqual({ services: ['plasma'], diagonals: ['55'] });
});

test('в ряду карточек-экранов есть человек ростом 175 см', async ({ page }) => {
  const row = page.locator('#scale-row');

  await expect(row).toContainText('рост 175 см');
  const rawCaption = await row.locator('[data-human-caption]').textContent();
  expect(rawCaption).toContain('175 см');
});

test('блоки главной: флагман, допоборудование, процесс, отзывы, тизер агентств и CTA-форма', async ({
  page,
}) => {
  await expect(page.locator('#flagship')).toContainText(SITE.flagship.name);
  await expect(page.getByRole('heading', { name: 'Нужно что-то ещё?' })).toBeVisible();
  const consultButton = page.locator('#more button[data-quiz-open]');
  await expect(consultButton).toBeVisible();
  const consultPreset = await consultButton.getAttribute('data-preset');
  expect(JSON.parse(consultPreset ?? 'null')).toEqual({ services: ['consult'] });

  await expect(page.getByRole('heading', { name: 'Как мы работаем' })).toBeVisible();
  await expect(page.locator('#process ol > li')).toHaveCount(4);

  await expect(page.locator('#reviews article')).toHaveCount(3);
  await expect(page.locator('#agencies a[href="/agentstvam/"]')).toBeVisible();

  const shortForm = page.locator('#short-form');
  await expect(shortForm).toBeVisible();
  await expect(shortForm.locator('input[name="channel"]')).toHaveCount(5);
  await expect(shortForm.locator('input[name="consent"]')).not.toBeChecked();
  await expect(shortForm.locator('a[href="/politika-konfidencialnosti/"]')).toBeVisible();
});

test('главная v1.1: без блока «Почему мы» и без пустой полосы логотипов', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /почему мы/i })).toHaveCount(0);
  await expect(page.locator('#clients')).toHaveCount(0);
});

test('FAQ: шесть вопросов, аккордеон открывается по клику', async ({ page }) => {
  const items = page.locator('#faq details');
  await expect(items).toHaveCount(FAQ_HOME.length);

  const second = items.nth(1);
  await expect(second).toHaveJSProperty('open', false);
  await second.locator('summary').click();
  await expect(second).toHaveJSProperty('open', true);
  await expect(second).toContainText(FAQ_HOME[1].a);
});

test('микроразметка: LocalBusiness, FAQPage из видимых текстов, четыре Product и отзывы', async ({
  page,
}) => {
  const nodes = await readJsonLd(page);
  expect(nodes.length).toBeGreaterThanOrEqual(4);

  const types = nodes.map((node) => node['@type']);
  expect(types).toContain('LocalBusiness');
  expect(types).toContain('Review');
  expect(types.filter((type) => type === 'Product')).toHaveLength(4);

  // Review.itemReviewed обязан ссылаться на ТОТ ЖЕ узел
  // LocalBusiness по '@id' (Base.astro), а не дублировать его как отдельную безымянную сущность —
  // иначе в графе получаются несвязанные организации и отзывы формально не о этом бизнесе.
  const business = requireNode(nodes, 'LocalBusiness');
  expect(business['@id']).toBe(new URL('/#business', SITE.url).href);
  const reviews = nodes.filter((node) => node['@type'] === 'Review');
  expect(reviews).toHaveLength(3);
  for (const review of reviews) {
    expect(review.itemReviewed).toEqual({ '@id': business['@id'] });
  }

  const faq = nodes.find((node) => node['@type'] === 'FAQPage');
  if (!faq) throw new Error('На главной нет разметки FAQPage');
  const questions = faq.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
  expect(questions).toHaveLength(FAQ_HOME.length);
  expect(questions.map((question) => question.name)).toEqual(FAQ_HOME.map((item) => item.q));
  expect(questions.map((question) => question.acceptedAnswer.text)).toEqual(
    FAQ_HOME.map((item) => item.a),
  );

  const products = nodes.filter((node) => node['@type'] === 'Product');
  expect(products.map((product) => product.url)).toEqual(
    DIAGONALS.map((diagonal) => new URL(`/plazmy/${diagonal.size}/`, SITE.url).href),
  );
  expect(products.map((product) => (product.offers as { price: number }).price)).toEqual(
    DIAGONALS.map((diagonal) => diagonal.prices.d1),
  );
});
