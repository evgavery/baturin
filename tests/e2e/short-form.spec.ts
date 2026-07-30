import { expect, test } from '@playwright/test';
import { SITE } from '../../src/config/site';
import { collectGoals, findLogLine } from './helpers';

// Лог накопительный, между прогонами не чистится. Статичный маркер рискует найтись в строке от
// ПРОШЛОГО прогона и дать ложный PASS, даже если СЕЙЧАС запись не произошла (регрессия) — поэтому
// маркеры, которые ищем в логе, помечаем суффиксом текущего прогона (см. quiz.spec.ts).
// readLog/findLogLine/LOG_PATH — общая реализация в tests/e2e/helpers.ts (финальная фикс-волна:
// раньше были продублированы в этом файле и ещё трёх спеках).
const runId = Date.now();

// #short-form — разметка CtaBlock с formType="short" (ТЗ §6.3). На сегодня в кодовой базе она
// подключена только на главной ("/") — CtaBlock на остальных страницах (в т.ч. /plazmy/, которую
// называет бриф Task 12) рендерит вариант с кнопкой квиза (Task 5+, закреплено тестами plazmy.spec.ts:
// `#cta button[data-quiz-open]`), а не короткую форму. Тестируем на реальном месте формы — см.
// раздел «Отклонения» task-12-report.md.

// Свой X-Test-IP на файл — иначе браузерные POST этого файла делят rate-limit-бакет 127.0.0.1
// (окно фикстуры 2 с) с quiz.spec.ts и qualify-form.spec.ts (см. quiz.spec.ts).
test.use({ extraHTTPHeaders: { 'X-Test-IP': '10.7.0.2' } });

test.describe('Короткая форма CTA (#short-form)', () => {
  test('успешная отправка: форма прячется, показывается успех с фокусом, цель lead_short, заявка в логе', async ({
    page,
  }) => {
    const goals = await collectGoals(page);
    await page.goto('/');
    const form = page.locator('#cta #short-form');
    const marker = `@test_short_${runId}`;

    await form.locator('input[name="name"]').fill('Короткая Форма');
    // Реальный клик мышью по видимому чипу (не .check()) — регрессионный тест на фикс hit-testing
    // в общем ChannelRadios.astro (Task 11 MINOR): раньше декоративный span перехватывал клики.
    await form.locator('label:has(input[name="channel"][value="telegram"])').click();
    await form.locator('input[name="contact"]').fill(marker);
    await form.locator('input[name="comment"]').fill(`тест-${runId}`);
    await form.locator('input[name="consent"]').check();

    await form.getByRole('button', { name: 'Отправить заявку' }).click();

    await expect(form).toBeHidden();
    const success = page.locator('#cta [data-success]');
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
    await expect.poll(goals).toContain('lead_short');

    const line = findLogLine(marker);
    expect(line).toBeDefined();
    expect(line).toContain('"form_type":"short"');
  });

  test('без согласия — блокировка с подсказкой, [data-errors] остаётся в DOM без hidden', async ({
    page,
  }) => {
    await page.goto('/');
    const form = page.locator('#cta #short-form');
    const errors = form.locator('[data-errors]');

    await expect(errors).toBeAttached();
    expect(await errors.getAttribute('hidden')).toBeNull();
    await expect(errors).toHaveText('');

    await form.locator('input[name="name"]').fill('Без Согласия');
    await form.locator('input[name="contact"]').fill(`@no_consent_short_${runId}`);
    // Чекбокс согласия НЕ трогаем — по умолчанию не отмечен.
    await form.getByRole('button', { name: 'Отправить заявку' }).click();

    await expect(errors).toContainText('Отметьте согласие');
    expect(await errors.getAttribute('hidden')).toBeNull();
    await expect(form).toBeVisible();
    await expect(page.locator('#cta [data-success]')).toBeHidden();
  });

  test('невалидный контакт для выбранного канала — ошибка (канал выбран реальным кликом)', async ({
    page,
  }) => {
    await page.goto('/');
    const form = page.locator('#cta #short-form');

    await form.locator('input[name="name"]').fill('Невалидный Контакт');
    // Канал НЕ дефолтный (Telegram предвыбран разметкой) — реальный клик по чипу WhatsApp.
    await form.locator('label:has(input[name="channel"][value="whatsapp"])').click();
    await form.locator('input[name="contact"]').fill('@nik');
    await form.locator('input[name="consent"]').check();
    await form.getByRole('button', { name: 'Отправить заявку' }).click();

    await expect(form.locator('[data-errors]')).toContainText('Проверьте контакт');
    await expect(page.locator('#cta [data-success]')).toBeHidden();
  });

  test('во время запроса кнопка недоступна; после сетевой ошибки — снова активна, ссылки на мессенджеры видны, введённое не потеряно', async ({
    page,
  }) => {
    await page.goto('/');
    let releaseRoute: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseRoute = resolve;
    });
    await page.route('**/api/lead.php', async (route) => {
      await gate;
      await route.abort();
    });

    const form = page.locator('#cta #short-form');
    const marker = `@net_error_short_${runId}`;
    await form.locator('input[name="name"]').fill('Сетевая Ошибка');
    await form.locator('label:has(input[name="channel"][value="telegram"])').click();
    await form.locator('input[name="contact"]').fill(marker);
    await form.locator('input[name="consent"]').check();

    const submitBtn = form.getByRole('button', { name: 'Отправить заявку' });
    await submitBtn.click();

    // Двойной submit заблокирован: кнопка недоступна, пока запрос не завершился.
    await expect(submitBtn).toBeDisabled();
    releaseRoute();

    await expect(form.locator('[data-errors]')).toContainText('Не получилось отправить');
    await expect(submitBtn).toBeEnabled();
    // Дизейбл на время запроса снимает фокус на <body> — после ошибки его обязаны вернуть на
    // кнопку (следующее действие рядом), иначе клавиатурный/скринридер-пользователь остаётся «нигде».
    await expect(submitBtn).toBeFocused();
    // Введённое не потеряно — форма не сбрасывается на ошибке.
    await expect(form.locator('input[name="name"]')).toHaveValue('Сетевая Ошибка');
    await expect(form.locator('input[name="contact"]')).toHaveValue(marker);

    const links = form.locator('[data-error-links]');
    await expect(links).toBeVisible();
    await expect(links.locator(`a[href="${SITE.tgLink}"]`)).toBeVisible();
    await expect(links.locator(`a[href="${SITE.waLink}"]`)).toBeVisible();
    await expect(links.locator(`a[href="${SITE.maxLink}"]`)).toBeVisible();
  });
});
