import { expect, test } from '@playwright/test';
import { SITE } from '../../src/config/site';
import { collectGoals, findLogLine } from './helpers';

// Маркеры, которые ищем в логе, помечаем суффиксом текущего прогона — накопительный лог иначе
// может дать ложный PASS по строке от прошлого запуска (см. quiz.spec.ts/short-form.spec.ts).
// readLog/findLogLine/LOG_PATH — общая реализация в tests/e2e/helpers.ts (финальная фикс-волна:
// раньше были продублированы в этом файле и ещё трёх спеках).
const runId = Date.now();

// Свой X-Test-IP на файл — иначе браузерные POST этого файла делят rate-limit-бакет 127.0.0.1
// (окно фикстуры 2 с) с quiz.spec.ts и short-form.spec.ts (см. quiz.spec.ts).
test.use({ extraHTTPHeaders: { 'X-Test-IP': '10.7.0.3' } });

test.describe('Форма подбора на главной (#qualify-form)', () => {
  test('полная отправка: услуга + тип клиента + need → успех с фокусом, цель lead_qualify, заявка в логе', async ({
    page,
  }) => {
    const goals = await collectGoals(page);
    await page.goto('/');
    const form = page.locator('#podbor #qualify-form');
    const marker = `@test_qualify_${runId}`;
    const need = '2 панели 75″ и задник';

    await form.locator('select[name="interest"]').selectOption('led');
    await form.locator('select[name="client_type"]').selectOption('agency');
    await form.locator('input[name="need"]').fill(need);
    await form.locator('input[name="name"]').fill('Подбор Оборудования');
    // Реальный клик мышью по видимому чипу (не .check()) — регресс на hit-testing:
    // раньше декоративный span в ChannelRadios.astro перехватывал клики.
    await form.locator('label:has(input[name="channel"][value="telegram"])').click();
    await form.locator('input[name="contact"]').fill(marker);
    await form.locator('input[name="consent"]').check();

    await form.getByRole('button', { name: 'Получить предложение' }).click();

    await expect(form).toBeHidden();
    const success = page.locator('#podbor [data-success]');
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
    await expect.poll(goals).toContain('lead_qualify');

    const line = findLogLine(marker);
    expect(line).toBeDefined();
    expect(line).toContain('"form_type":"qualify"');
    expect(line).toContain('"services":["led"]');
    expect(line).toContain('"client_type":"agency"');
    // Ключ+значение, а не голая подстрока need: строка иначе могла бы случайно совпасть с
    // другим полем лога; выражение собрано из той же переменной need, что ушла в форму, —
    // никакого второго литерала с тем же текстом, который мог бы разойтись при правке теста.
    expect(line).toContain(`"comment":"${need}"`);
  });

  test('без согласия — блокировка с подсказкой, [data-errors] остаётся в DOM без hidden', async ({
    page,
  }) => {
    await page.goto('/');
    const form = page.locator('#podbor #qualify-form');
    const errors = form.locator('[data-errors]');

    await expect(errors).toBeAttached();
    expect(await errors.getAttribute('hidden')).toBeNull();
    await expect(errors).toHaveText('');

    await form.locator('input[name="name"]').fill('Без Согласия Подбор');
    await form.locator('input[name="contact"]').fill(`@no_consent_qualify_${runId}`);
    // Чекбокс согласия НЕ трогаем — по умолчанию не отмечен.
    await form.getByRole('button', { name: 'Получить предложение' }).click();

    await expect(errors).toContainText('Отметьте согласие');
    expect(await errors.getAttribute('hidden')).toBeNull();
    await expect(form).toBeVisible();
    await expect(page.locator('#podbor [data-success]')).toBeHidden();
  });

  test('канал WhatsApp + ник вместо телефона — ошибка валидации контакта (канал выбран реальным кликом)', async ({
    page,
  }) => {
    await page.goto('/');
    const form = page.locator('#podbor #qualify-form');

    await form.locator('input[name="name"]').fill('Валидация WA Подбор');
    await form.locator('label:has(input[name="channel"][value="whatsapp"])').click();
    await form.locator('input[name="contact"]').fill('@nik');
    await form.locator('input[name="consent"]').check();
    await form.getByRole('button', { name: 'Получить предложение' }).click();

    await expect(form.locator('[data-errors]')).toContainText('Проверьте контакт');
    await expect(page.locator('#podbor [data-success]')).toBeHidden();
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

    const form = page.locator('#podbor #qualify-form');
    const marker = `@net_error_qualify_${runId}`;
    await form.locator('input[name="name"]').fill('Сетевая Ошибка Подбор');
    await form.locator('label:has(input[name="channel"][value="telegram"])').click();
    await form.locator('input[name="contact"]').fill(marker);
    await form.locator('input[name="consent"]').check();

    const submitBtn = form.getByRole('button', { name: 'Получить предложение' });
    await submitBtn.click();

    await expect(submitBtn).toBeDisabled();
    releaseRoute();

    await expect(form.locator('[data-errors]')).toContainText('Не получилось отправить');
    await expect(submitBtn).toBeEnabled();
    // Дизейбл на время запроса снимает фокус на <body> — после ошибки его обязаны вернуть на
    // кнопку (следующее действие рядом), иначе клавиатурный/скринридер-пользователь остаётся «нигде».
    await expect(submitBtn).toBeFocused();
    await expect(form.locator('input[name="name"]')).toHaveValue('Сетевая Ошибка Подбор');
    await expect(form.locator('input[name="contact"]')).toHaveValue(marker);

    const links = form.locator('[data-error-links]');
    await expect(links).toBeVisible();
    await expect(links.locator(`a[href="${SITE.tgLink}"]`)).toBeVisible();
    await expect(links.locator(`a[href="${SITE.waLink}"]`)).toBeVisible();
    await expect(links.locator(`a[href="${SITE.maxLink}"]`)).toBeVisible();
  });

  test('сноска-ссылка на /agentstvam/ рядом с формой кликабельна', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('#podbor a[href="/agentstvam/"]');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/agentstvam\/$/);
  });
});
