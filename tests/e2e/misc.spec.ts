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

  await expect(nav).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await expect(nav).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

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
