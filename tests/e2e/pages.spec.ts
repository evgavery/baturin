import { expect, test } from '@playwright/test';
import { SITE } from '../../src/config/site';
import { FAQ_STREAM, FAQ_TOUCH } from '../../src/data/faq';
import { plain, readJsonLd, requireNode, rub } from './helpers';

// Задача 7: /touch-paneli/ (железо, карточки позиций) и /videotranslyacii/ (услуга,
// структура другая — состав/пакеты/процесс). Задача 8 дописывает вторую часть файла.

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

// Задача 8: /agentstvam/, /kontakty/, /politika-konfidencialnosti/ — три «о компании»
// страницы (не железо и не услуга): различий в структуре с направлениями больше, чем
// сходства, поэтому у каждой свой набор проверок вместо переиспользуемого шаблона.

test.describe('/agentstvam/', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agentstvam/');
  });

  test('H1, title в лимите и хлебные крошки', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Агентствам и корпоративным заказчикам');

    const title = await page.title();
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain(SITE.brandName);

    const description =
      (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    expect(description.length).toBeLessThanOrEqual(160);

    const crumbs = page.locator('nav[aria-label="Хлебные крошки"]');
    await expect(crumbs.locator('a[href="/"]')).toBeVisible();
    await expect(crumbs).toContainText('Агентствам');
  });

  test('white label: техники — «ваша команда», без нашей символики', async ({ page }) => {
    const block = page.locator('#white-label');
    await expect(block).toContainText('ваша команда');
    await expect(block).toContainText(/символик/i);
  });

  test('агентские условия — текст из SITE.agencyTerms, а не выдуманная сетка скидок', async ({
    page,
  }) => {
    await expect(page.locator('#agency-terms')).toContainText(SITE.agencyTerms);
  });

  test('документы: договор, безнал, ЭДО, закрывающие в срок, юрлица, закупки', async ({
    page,
  }) => {
    const block = page.locator('#documents');
    await expect(block).toContainText(/договор/i);
    await expect(block).toContainText(/безнал/i);
    await expect(block).toContainText('ЭДО');
    await expect(block).toContainText(/закрывающ/i);
    await expect(block).toContainText(/юрлиц/i);
    await expect(block).toContainText(/закупк/i);
  });

  test('скорость: смета за 30 минут, резерв оборудования, ночные монтажи', async ({ page }) => {
    const block = page.locator('#speed');
    await expect(block).toContainText(/30\s*минут/);
    await expect(block).toContainText(/резерв/i);
    await expect(block).toContainText(/ночн/i);
  });

  test('персональный контакт: напрямую с теми, кто приедет на площадку, без колл-центра', async ({
    page,
  }) => {
    const block = page.locator('#personal-contact');
    await expect(block).toContainText(/напрямую/i);
    await expect(block).toContainText(/колл-центр/i);
  });

  test('CTA «Обсудить сотрудничество» с пресетом consult', async ({ page }) => {
    const cta = page.locator('#cta button[data-quiz-open]');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText('Обсудить сотрудничество');
    expect(JSON.parse((await cta.getAttribute('data-preset')) ?? 'null')).toEqual({
      services: ['consult'],
    });
  });
});

test.describe('/kontakty/', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kontakty/');
  });

  test('H1, title в лимите и хлебные крошки', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Контакты');

    const title = await page.title();
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain(SITE.brandName);

    const description =
      (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    expect(description.length).toBeLessThanOrEqual(160);

    const crumbs = page.locator('nav[aria-label="Хлебные крошки"]');
    await expect(crumbs.locator('a[href="/"]')).toBeVisible();
    await expect(crumbs).toContainText('Контакты');
  });

  test('телефон с целью click_phone и почта — в содержимом страницы', async ({ page }) => {
    // Шапка и подвал уже показывают эти контакты — тут проверяем именно блок страницы
    // (#hero), а не первый попавшийся сайтовый экземпляр ссылки.
    const hero = page.locator('#hero');

    const phone = hero.locator('a[data-goal="click_phone"]');
    await expect(phone).toHaveAttribute('href', SITE.phoneHref);
    await expect(phone).toContainText(SITE.phone);

    const email = hero.locator(`a[href="mailto:${SITE.email}"]`);
    await expect(email).toBeVisible();
  });

  test('три мессенджера с целями Метрики', async ({ page }) => {
    const messengers = page.locator('#messengers');
    const targets: [string, string][] = [
      ['click_tg', SITE.tgLink],
      ['click_wa', SITE.waLink],
      ['click_max', SITE.maxLink],
    ];

    for (const [goal, href] of targets) {
      const link = messengers.locator(`a[data-goal="${goal}"]`);
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });

  test('режим работы, зона работы и реквизиты — из конфига', async ({ page }) => {
    await expect(page.locator('#hours')).toContainText('Заявки принимаем круглосуточно');
    await expect(page.locator('#area')).toContainText(SITE.workArea);
    await expect(page.locator('#requisites')).toContainText(SITE.requisites);
  });

  test('CTA-блок перед подвалом', async ({ page }) => {
    await expect(page.locator('#cta button[data-quiz-open]')).toBeVisible();
  });
});

test('/kontakty/: без карт и виджетов — нет iframe и ни одного внешнего сетевого запроса', async ({
  page,
}) => {
  // Слушатель — до перехода: запросы первой загрузки иначе не поймать.
  // Пустой список внешних хостов сильнее частной проверки на api-maps: он ловит вообще
  // любой виджет, а не только карты.
  const externalHosts = new Set<string>();
  page.on('request', (request) => {
    const host = new URL(request.url()).host;
    if (host !== '127.0.0.1:4321') externalHosts.add(host);
  });

  await page.goto('/kontakty/');

  await expect(page.locator('iframe')).toHaveCount(0);
  expect(Array.from(externalHosts)).toEqual([]);
});

test.describe('/politika-konfidencialnosti/', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/politika-konfidencialnosti/');
  });

  test('H1, title в лимите, хлебные крошки и без noindex', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Политика конфиденциальности');

    const title = await page.title();
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain(SITE.brandName);

    const description =
      (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    expect(description.length).toBeLessThanOrEqual(160);

    // Обычная страница, а не служебная 404 — самоссылающийся canonical есть, noindex нет.
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new URL('/politika-konfidencialnosti/', SITE.url).href,
    );

    const crumbs = page.locator('nav[aria-label="Хлебные крошки"]');
    await expect(crumbs.locator('a[href="/"]')).toBeVisible();
  });

  test('оператор — реквизиты из SITE.requisites', async ({ page }) => {
    await expect(page.locator('main')).toContainText(SITE.requisites);
  });

  test('состав персональных данных соответствует полям реальных форм', async ({ page }) => {
    const main = page.locator('main');
    for (const phrase of [/имя/i, /телефон/i, /ник в мессенджере/i, /e-mail/i, /компани/i]) {
      await expect(main).toContainText(phrase);
    }
  });

  test('цели обработки и правовое основание — согласие субъекта', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toContainText(/цел/i);
    await expect(main).toContainText(/согласи/i);
  });

  test('получатели данных — именно Telegram Bot API и SMTP, третьим лицам не передаются', async ({
    page,
  }) => {
    const main = page.locator('main');
    await expect(main).toContainText('Telegram Bot API');
    await expect(main).toContainText('SMTP');
  });

  test('упоминание cookies и Яндекс.Метрики', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toContainText(/cookie/i);
    await expect(main).toContainText('Яндекс.Метрика');
  });

  test('права субъекта и контакт для обращений — SITE.email', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toContainText(/права субъекта/i);
    await expect(main).toContainText(SITE.email);
  });

  test('пометка о необходимости проверки юристом', async ({ page }) => {
    await expect(page.locator('main')).toContainText(
      'Документ подготовлен автоматически, требуется проверка юристом.',
    );
  });

  test('CTA-блок перед подвалом', async ({ page }) => {
    await expect(page.locator('#cta button[data-quiz-open]')).toBeVisible();
  });
});

test('титулы агентствам, контактов и политики уникальны', async ({ page }) => {
  const titles = new Set<string>();
  for (const path of ['/agentstvam/', '/kontakty/', '/politika-konfidencialnosti/']) {
    await page.goto(path);
    titles.add(await page.title());
  }
  expect(titles.size).toBe(3);
});
