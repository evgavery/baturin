import { expect, test } from '@playwright/test';
import { SITE } from '../../src/config/site';
import { collectGoals } from './helpers';

const DIRECTIONS = ['/plazmy/', '/led-ekrany/', '/touch-paneli/', '/videotranslyacii/'];

test('robots.txt разрешает обход и указывает на sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt');

  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain('User-agent: *');
  expect(body).toContain(`Sitemap: ${new URL('sitemap-index.xml', SITE.url).href}`);
});

test('страница 404 отдаётся и ведёт на четыре направления', async ({ page }) => {
  const response = await page.goto('/404.html');

  expect(response?.status()).toBe(200);
  for (const href of DIRECTIONS) {
    await expect(page.locator(`main a[href="${href}"]`)).toBeVisible();
  }
});

test('на главной есть телефон в шапке, док мессенджеров и реквизиты в подвале', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.locator('header a[data-goal="click_phone"]')).toBeVisible();
  await expect(page.locator('#messenger-dock a[data-goal="click_tg"]')).toBeVisible();
  await expect(page.locator('footer')).toContainText(SITE.requisites);
});

test('cookie-строка скрывается по согласию и не возвращается после перезагрузки', async ({
  page,
}) => {
  await page.goto('/');
  const bar = page.locator('#cookie-bar');
  await expect(bar).toBeVisible();

  await page.locator('#cookie-ok').click();
  await expect(bar).toBeHidden();

  await page.reload();
  await expect(bar).toBeHidden();
});

test('на мобильном бургер открывает и закрывает меню', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const nav = page.locator('#site-nav');
  const toggle = page.locator('#nav-toggle');
  const navItems = nav.locator('a, button');

  await expect(nav).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  // Открываем клавиатурой (Enter на сфокусированном toggle), не click() — сценарий дословно про
  // клавиатурного пользователя: он активирует бургер и продолжает Tab вперёд.
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(nav).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  // nav в DOM стоит раньше toggle (нужно для порядка на десктопе) — без явного переноса фокуса
  // открытые пункты меню оказались бы в tab-порядке РАНЬШЕ toggle, и клавиатурный пользователь,
  // продолжая Tab вперёд от toggle, проскакивал бы мимо открытого меню в контент страницы.
  await expect(navItems.first()).toBeFocused();

  // Tab продолжает естественно вглубь меню (а не наружу из него) — второй пункт следующий по
  // порядку, не какой-то элемент вне nav.
  await page.keyboard.press('Tab');
  await expect(navItems.nth(1)).toBeFocused();

  await toggle.click();
  await expect(nav).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('клик по телефону в шапке отправляет цель click_phone', async ({ page }) => {
  const goals = await collectGoals(page);
  await page.goto('/');

  // tel:-навигация в headless не завершается, ждать её нельзя.
  await page.locator('header a[data-goal="click_phone"]').click({ noWaitAfter: true });

  await expect.poll(goals).toContain('click_phone');
});

test('prefers-reduced-motion: анимация «включения» hero-карточек сжимается почти до нуля', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  // [data-screen-in]: слайдер парка + 3 бокса-факта — все идут с animation: screen-in 240ms
  // (index.astro). Глушит global.css: animation-duration: 0.01ms !important под reduce.
  const cards = page.locator('[data-screen-in]');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const duration = await cards.nth(i).evaluate((el) => getComputedStyle(el).animationDuration);
    // Computed style отдаёт время в секундах (0.01ms = 1e-05s) — сравниваем как число, а не
    // строкой: обычная (не приглушённая) длительность анимации — 240ms = 0.24s, порог с большим
    // запасом ниже неё.
    expect(Number.parseFloat(duration)).toBeLessThan(0.001);
  }
});

test('prefers-reduced-motion: автопрокрутка слайдера парка не стартует', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const firstDot = page.locator('[data-dot]').first();
  await expect(firstDot).toHaveAttribute('aria-current', 'true');

  // AUTOPLAY_MS = 6000 (hero-slider.ts) — 7 с с запасом: без reduced-motion слайд к этому
  // моменту уже сменился бы (see play(): reducedMotion.matches блокирует запуск таймера).
  await page.clock.fastForward(7000);

  await expect(firstDot).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-dot]').nth(1)).not.toHaveAttribute('aria-current', 'true');
});
