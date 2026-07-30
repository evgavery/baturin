import { expect, test } from '@playwright/test';
import { collectGoals, findLogLine } from './helpers';

// Лог накопительный, между прогонами не чистится. Статичный маркер рискует найтись в строке от
// ПРОШЛОГО прогона и дать ложный PASS, даже если СЕЙЧАС запись не произошла (регрессия). Поэтому
// маркеры, которые ищем в логе, помечаем суффиксом текущего прогона (см. lead-api.spec.ts).
// readLog/findLogLine/LOG_PATH — общая реализация в tests/e2e/helpers.ts (финальная фикс-волна:
// раньше были продублированы в этом файле и ещё трёх спеках).
const runId = Date.now();

// Кнопка «Получить смету» в шапке дублируется (десктоп-версия и версия внутри мобильного меню) —
// в разметке видна только одна в зависимости от ширины вьюпорта,:visible берёт ровно её.
const HEADER_QUIZ_BUTTON = 'header button[data-quiz-open]:visible';

// Браузерные POST этого файла (через fetch со страницы) идут с одним и тем же 127.0.0.1 — без
// разнесения по X-Test-IP они делят один rate-limit-бакет (окно фикстуры — 2 с) с short-form.spec.ts
// и qualify-form.spec.ts. Коллизия сегодня теоретическая (файлы гоняются последовательно), но
// фикс превентивный: extraHTTPHeaders контекста уходит со всеми запросами, включая fetch со
// страницы; test_mode fixture честно доверяет X-Test-IP (см. tests/fixtures/lead-config.test.php).
test.use({ extraHTTPHeaders: { 'X-Test-IP': '10.7.0.1' } });

test.describe('Квиз «Получить смету»', () => {
  test('(1) кнопка шапки открывает квиз и отправляет цель quiz_open', async ({ page }) => {
    const goals = await collectGoals(page);
    await page.goto('/');

    await page.locator(HEADER_QUIZ_BUTTON).click();

    await expect(page.locator('#quiz')).toBeVisible();
    await expect.poll(goals).toContain('quiz_open');
  });

  test('(2) «В смету» на карточке 75″ переносит preset в квиз', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');

    await page.locator('[data-screen-card="75"] button[data-quiz-open]').click();

    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[name="services"][value="plasma"]')).toBeChecked();
    await expect(dialog.locator('input[name="diagonals"][value="75"]')).toBeChecked();
  });

  test('(3) шаг 1 без выбора: «Далее» показывает ошибку и не переключает шаг', async ({
    page,
  }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();

    await dialog.getByRole('button', { name: 'Далее' }).click();

    await expect(dialog.locator('[data-errors]')).toContainText('Выберите, что нужно');
    await expect(dialog.locator('[data-step="1"]')).toBeVisible();
    await expect(dialog.locator('[data-step="2"]')).toBeHidden();
  });

  test('(4) полный проход квиза: успех, цели и заявка в логе', async ({ page }) => {
    const goals = await collectGoals(page);
    await page.goto('/');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();

    // Шаг 1: плазма 75″.
    await dialog.locator('input[name="services"][value="plasma"]').check();
    await dialog.locator('input[name="diagonals"][value="75"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await expect(dialog.locator('[data-step="2"]')).toBeVisible();
    await expect.poll(goals).toContain('quiz_step2');

    // Шаг 2: дата, «1 день», площадка.
    await dialog.locator('input[name="date"]').fill('2026-09-12');
    await dialog.locator('input[name="duration"][value="1"]').check();
    await dialog.locator('input[name="venue"]').fill('Крокус, зал 3');
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await expect(dialog.locator('[data-step="3"]')).toBeVisible();
    await expect.poll(goals).toContain('quiz_step3');

    // Шаг 3: имя, «Ивент-агентство», Telegram + @ivan_test.
    const marker = `@ivan_test_${runId}`;
    await dialog.locator('input[name="name"]').fill('Иван');
    await dialog.locator('select[name="client_type"]').selectOption('agency');
    await dialog.locator('input[name="channel"][value="telegram"]').check();
    await dialog.locator('input[name="contact"]').fill(marker);
    await dialog.locator('input[name="consent"]').check();
    await dialog.getByRole('button', { name: 'Получить смету' }).click();

    await expect(dialog.locator('[data-screen="success"]')).toBeVisible();
    await expect(dialog.locator('[data-screen="success"]')).toContainText('в Telegram');
    await expect.poll(goals).toContain('lead_quiz');
    expect(await goals()).toEqual(
      expect.arrayContaining(['quiz_open', 'quiz_step2', 'quiz_step3', 'lead_quiz']),
    );

    const line = findLogLine(marker);
    expect(line).toBeDefined();
    expect(line).toContain('"diagonals":["75"]');
    expect(line).toContain('"client_type":"agency"');
  });

  test('(5) без согласия отправка блокируется', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();

    await dialog.locator('input[name="services"][value="consult"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await dialog.getByRole('button', { name: 'Далее' }).click();

    await dialog.locator('input[name="name"]').fill('Без согласия');
    await dialog.locator('input[name="channel"][value="telegram"]').check();
    await dialog.locator('input[name="contact"]').fill('@no_consent_test');
    // Чекбокс согласия НЕ трогаем — по умолчанию не отмечен.
    await dialog.getByRole('button', { name: 'Получить смету' }).click();

    await expect(dialog.locator('[data-errors]')).toContainText(
      'Отметьте согласие на обработку данных',
    );
    await expect(dialog.locator('[data-screen="success"]')).toBeHidden();
  });

  test('(6) WhatsApp: ник отклоняется, телефон проходит', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();

    await dialog.locator('input[name="services"][value="consult"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await dialog.getByRole('button', { name: 'Далее' }).click();

    await dialog.locator('input[name="name"]').fill('Валидация WA');
    await dialog.locator('input[name="channel"][value="whatsapp"]').check();
    await dialog.locator('input[name="contact"]').fill('@nik');
    await dialog.locator('input[name="consent"]').check();
    await dialog.getByRole('button', { name: 'Получить смету' }).click();

    await expect(dialog.locator('[data-errors]')).toContainText('Проверьте контакт');
    await expect(dialog.locator('[data-screen="success"]')).toBeHidden();

    await dialog.locator('input[name="contact"]').fill('+7 916 000-00-00');
    await dialog.getByRole('button', { name: 'Получить смету' }).click();

    await expect(dialog.locator('[data-screen="success"]')).toBeVisible();
  });

  test('(7) сетевая ошибка показывает error-экран, данные не теряются', async ({ page }) => {
    await page.goto('/');
    await page.route('**/api/lead.php', (route) => route.abort());
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();

    await dialog.locator('input[name="services"][value="consult"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await dialog.getByRole('button', { name: 'Далее' }).click();

    await dialog.locator('input[name="name"]').fill('Пётр Ошибкин');
    await dialog.locator('input[name="channel"][value="telegram"]').check();
    await dialog.locator('input[name="contact"]').fill('@petr_error_test');
    await dialog.locator('input[name="consent"]').check();
    await dialog.getByRole('button', { name: 'Получить смету' }).click();

    await expect(dialog.locator('[data-screen="error"]')).toBeVisible();

    await dialog.locator('[data-close]').click();
    await expect(dialog).toBeHidden();

    await page.locator(HEADER_QUIZ_BUTTON).click();
    await expect(dialog.locator('input[name="name"]')).toHaveValue('Пётр Ошибкин');
  });

  const remainingChannels: { channel: string; label: string; contact: string }[] = [
    { channel: 'email', label: 'E-mail', contact: `ivan.${runId}@example.ru` },
    { channel: 'max', label: 'MAX', contact: `+7916${String(runId).slice(-6)}` },
    { channel: 'call', label: 'Позвоните мне', contact: `+7917${String(runId).slice(-6)}` },
  ];

  for (const { channel, label, contact } of remainingChannels) {
    test(`(8) канал ${label}: заявка уходит с channel=${channel}`, async ({ page }) => {
      await page.goto('/');
      const dialog = page.locator('#quiz');
      await page.locator(HEADER_QUIZ_BUTTON).click();

      await dialog.locator('input[name="services"][value="consult"]').check();
      await dialog.getByRole('button', { name: 'Далее' }).click();
      await dialog.getByRole('button', { name: 'Далее' }).click();

      await dialog.locator('input[name="name"]').fill(`Канал ${label}`);
      await dialog.locator(`input[name="channel"][value="${channel}"]`).check();
      await dialog.locator('input[name="contact"]').fill(contact);
      await dialog.locator('input[name="consent"]').check();
      await dialog.getByRole('button', { name: 'Получить смету' }).click();

      await expect(dialog.locator('[data-screen="success"]')).toBeVisible();

      const line = findLogLine(contact);
      expect(line).toBeDefined();
      expect(line).toContain(`"channel":"${channel}"`);
    });
  }

  test('(9) закрытие крестиком на шаге 2 сохраняет шаг и данные', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();

    await dialog.locator('input[name="services"][value="led"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await dialog.locator('input[name="venue"]').fill('Экспоцентр, павильон 2');

    await dialog.locator('[data-close]').click();
    await expect(dialog).toBeHidden();

    await page.locator(HEADER_QUIZ_BUTTON).click();
    await expect(dialog.locator('[data-step="2"]')).toBeVisible();
    await expect(dialog.locator('input[name="venue"]')).toHaveValue('Экспоцентр, павильон 2');
  });

  test('(10) UTM из query сохраняется и уходит в лог', async ({ page }) => {
    await page.goto('/?utm_source=direct&utm_medium=cpc&utm_campaign=led');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();

    await dialog.locator('input[name="services"][value="touch"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await dialog.getByRole('button', { name: 'Далее' }).click();

    const marker = `@utm_test_${runId}`;
    await dialog.locator('input[name="name"]').fill('UTM Test');
    await dialog.locator('input[name="channel"][value="telegram"]').check();
    await dialog.locator('input[name="contact"]').fill(marker);
    await dialog.locator('input[name="consent"]').check();
    await dialog.getByRole('button', { name: 'Получить смету' }).click();

    await expect(dialog.locator('[data-screen="success"]')).toBeVisible();

    const line = findLogLine(marker);
    expect(line).toBeDefined();
    expect(line).toContain('"source":"direct"');
  });

  // Обязательный кейс ревью Task 10: U+FEFF (BOM из копипасты телефона) матчится JS-\s, но не
  // серверным PCRE и не срезается PHP trim() — если фронт не чистит невидимые символы при вводе,
  // валидная на вид заявка получает 400 от сервера и клиент теряется молча. Нормализация — на
  // уровне UI (Task 11), сами регексы quiz-core остаются посимвольным зеркалом lead.php.
  test('(11) невидимый BOM в контакте не мешает отправке', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();

    await dialog.locator('input[name="services"][value="consult"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await dialog.getByRole('button', { name: 'Далее' }).click();

    await dialog.locator('input[name="name"]').fill('БОМ Тест');
    await dialog.locator('input[name="channel"][value="whatsapp"]').check();
    await dialog.locator('input[name="contact"]').fill('\uFEFF+79161234567');
    await dialog.locator('input[name="consent"]').check();
    await dialog.getByRole('button', { name: 'Получить смету' }).click();

    await expect(dialog.locator('[data-screen="success"]')).toBeVisible();
  });

  // Review Gate (Фейбл), MINOR 1: data-preset — JSON-строка на статичной странице, которую
  // может испортить будущая опечатка (например, `services` в единственном числе). Раньше
  // initialState() слепо спредил такой объект поверх дефолтов, и «plasma».includes(...)
  // как побочный эффект «угадывал» чекбокс, а первое же снятие галки роняло state.services.filter
  // (у строки нет .filter). Кнопка шапки дублируется (десктоп/мобилка) — правим оба узла.
  test('(12) битый data-preset не роняет квиз и открывается пустым', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');

    await page.evaluate(() => {
      document.querySelectorAll('header button[data-quiz-open]').forEach((btn) => {
        btn.setAttribute('data-preset', '{"services":"plasma"}');
      });
    });

    await page.locator(HEADER_QUIZ_BUTTON).click();

    // render() выполняется ДО showModal() — если бы сырой preset уронил рендер, диалог остался бы
    // закрыт; то, что он открылся, уже часть доказательства устойчивости.
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-step="1"]')).toBeVisible();
    // Битое поле должно быть отброшено целиком (санитизация формы), а не «угадано»: раньше
    // строка молча включала чекбокс с тем же именем. Состояние — дефолт: ничего не выбрано.
    await expect(dialog.locator('input[name="services"][value="plasma"]')).not.toBeChecked();

    // Живой прогон взаимодействия — старый баг падал именно на снятии галки после «угаданного»
    // preset (state.services.filter на строке). Чек/анчек и переход дальше работают без исключений.
    await dialog.locator('input[name="services"][value="plasma"]').check();
    await dialog.locator('input[name="services"][value="plasma"]').uncheck();
    await dialog.locator('input[name="services"][value="consult"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await expect(dialog.locator('[data-step="2"]')).toBeVisible();
  });

  // Review Gate (Фейбл), IMPORTANT 2: элемент с `hidden` отсутствует в accessibility tree, а
  // переход hidden→visible с уже вставленным текстом скринридеры стабильно не анонсируют.
  // [data-errors] обязан оставаться в DOM всегда (без hidden) — и пустым, и с текстом ошибки —
  // управляем только textContent. Заодно перепроверяем кейсы 3/5/6: toContainText по-прежнему честен.
  test('(13) [data-errors] остаётся в DOM без hidden — пустой, с ошибкой и снова пустой', async ({
    page,
  }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();
    const errors = dialog.locator('[data-errors]');

    await expect(errors).toBeAttached();
    expect(await errors.getAttribute('hidden')).toBeNull();
    await expect(errors).toHaveText('');

    await dialog.getByRole('button', { name: 'Далее' }).click();
    await expect(errors).toContainText('Выберите, что нужно');
    expect(await errors.getAttribute('hidden')).toBeNull();

    await dialog.locator('input[name="services"][value="consult"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await expect(dialog.locator('[data-step="2"]')).toBeVisible();
    expect(await errors.getAttribute('hidden')).toBeNull();
    await expect(errors).toHaveText('');
  });

  // Review Gate (Фейбл), MINOR 2: click по затемнению закрывает диалог по координатам, но click
  // возникает и тогда, когда mousedown был внутри поля (выделение текста), а mouseup — за панелью.
  // Закрывать можно только жест, который И начался, И закончился за пределами панели.
  test('(14) выделение текста мышью не закрывает квиз, даже если отпустить за панелью', async ({
    page,
  }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();
    await dialog.locator('input[name="services"][value="consult"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();

    const venue = dialog.locator('input[name="venue"]');
    await venue.fill('Текст для выделения');
    const box = await venue.boundingBox();
    if (!box) throw new Error('поле venue без bounding box');

    // Драг мышью: старт внутри поля (обычное выделение текста), отпускание — заведомо за пределами
    // панели (левый край вьюпорта; панель — правая шторка min(560px, 100%) при вьюпорте 1280×720).
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(10, 10, { steps: 5 });
    await page.mouse.up();

    await expect(dialog).toBeVisible();
    await expect(venue).toHaveValue('Текст для выделения');
  });

  // Страховка к (14): фикс не должен сломать исходное поведение — обычный клик по затемнению
  // (нажатие и отпускание в одной точке, вне панели) по-прежнему закрывает диалог.
  test('(15) обычный клик по затемнению вне панели по-прежнему закрывает квиз', async ({
    page,
  }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();
    await expect(dialog).toBeVisible();

    await page.mouse.click(10, 10);

    await expect(dialog).toBeHidden();
  });

  // Review Gate (Фейбл), MINOR 3: setSubmitDisabled(true) дизейблит сфокусированную кнопку, потом
  // formView.hidden прячет её контейнер целиком — без явного переноса фокус проваливается на body,
  // и SR-пользователь остаётся «нигде». После showResultView фокус обязан быть на новом экране.
  test('(16) после успешной отправки фокус переходит на текст успеха', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();

    await dialog.locator('input[name="services"][value="consult"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await dialog.getByRole('button', { name: 'Далее' }).click();

    await dialog.locator('input[name="name"]').fill('Фокус Тест');
    await dialog.locator('input[name="channel"][value="telegram"]').check();
    await dialog.locator('input[name="contact"]').fill(`@focus_success_${runId}`);
    await dialog.locator('input[name="consent"]').check();
    await dialog.getByRole('button', { name: 'Получить смету' }).click();

    await expect(dialog.locator('[data-screen="success"]')).toBeVisible();
    await expect(dialog.locator('[data-success-text]')).toBeFocused();
  });

  test('(17) после сетевой ошибки фокус переходит на «Попробовать ещё раз»', async ({ page }) => {
    await page.goto('/');
    await page.route('**/api/lead.php', (route) => route.abort());
    const dialog = page.locator('#quiz');
    await page.locator(HEADER_QUIZ_BUTTON).click();

    await dialog.locator('input[name="services"][value="consult"]').check();
    await dialog.getByRole('button', { name: 'Далее' }).click();
    await dialog.getByRole('button', { name: 'Далее' }).click();

    await dialog.locator('input[name="name"]').fill('Фокус Ошибка');
    await dialog.locator('input[name="channel"][value="telegram"]').check();
    await dialog.locator('input[name="contact"]').fill(`@focus_error_${runId}`);
    await dialog.locator('input[name="consent"]').check();
    await dialog.getByRole('button', { name: 'Получить смету' }).click();

    await expect(dialog.locator('[data-screen="error"]')).toBeVisible();
    await expect(dialog.locator('[data-action="retry"]')).toBeFocused();
  });

  // Финальное ревью (Фейбл), IMPORTANT 3: sanitizePartialState раньше принимала ЛЮБУЮ строку как
  // channel (проверялся только typeof, не значение) — applyChannelUx() затем делает
  // CHANNEL_UX[channel].placeholder, и обращение к несуществующему ключу бросает TypeError прямо
  // в render(), которая выполняется ДО showModal(). Испорченный channel в sessionStorage (а не
  // только в разовом data-preset) переживает перезагрузки — без whitelist квиз переставал
  // открываться вообще, пока сторадж не очистят вручную.
  test('(18) битый channel в sessionStorage не роняет открытие квиза', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.addInitScript(() => {
      sessionStorage.setItem('quiz_state_v1', JSON.stringify({ channel: 'pigeon' }));
    });
    await page.goto('/');
    const dialog = page.locator('#quiz');

    await page.locator(HEADER_QUIZ_BUTTON).click();

    // render() выполняется ДО showModal() — если бы битый channel уронил рендер (как раньше —
    // TypeError в applyChannelUx), диалог остался бы закрыт; то, что он открылся, уже часть
    // доказательства устойчивости.
    await expect(dialog).toBeVisible();
    // Канал — дефолтный (initialState(): channel = null), а не «угадан» из мусора: ни один радио
    // не выбран. Поля шага 3 остаются в DOM и получают значения от render() независимо от того,
    // какой шаг сейчас показан (hidden скрывает только контейнер шага, не сам инпут).
    await expect(dialog.locator('input[name="channel"]:checked')).toHaveCount(0);
    // Плейсхолдер контакта — дефолтный (CHANNEL_UX_DEFAULT), а не результат обращения к
    // несуществующему CHANNEL_UX['pigeon'].
    await expect(dialog.locator('input[name="contact"]')).toHaveAttribute(
      'placeholder',
      'Телефон, ник или e-mail',
    );
    expect(errors).toEqual([]);
  });
});
