import { expect, test } from '@playwright/test';
import { apiPost, findLogLine } from './helpers';

// Валидный payload — образец из ТЗ §6.4 / брифа Task 9.
const valid = {
  form_type: 'quiz',
  services: ['led', 'plasma'],
  details: { diagonals: ['75'], qty: 2, led_size: '4x2.5', outdoor: false },
  date: '2026-09-12',
  duration: '1',
  venue: 'Крокус, зал 3',
  comment: 'нужен задник сцены',
  name: 'Иван',
  company: 'Агентство',
  client_type: 'agency',
  channel: 'telegram',
  contact: '@ivan_test',
  consent: true,
  page: '/led-ekrany/',
  utm: { source: 'direct', medium: '', campaign: '', content: '', term: '' },
  hp: '',
};

// Лог накопительный и между прогонами не чистится. Статичный маркер типа "@ivan_test" рискует
// найтись в строке от ПРОШЛОГО прогона и дать ложный PASS, даже если в ТЕКУЩЕМ прогоне запись не
// записалась (регрессия). Поэтому маркеры, которые ищутся в логе, помечаем суффиксом текущего
// прогона — тогда совпасть может только строка, записанная именно сейчас.
// readLog/findLogLine/LOG_PATH — общая реализация в tests/e2e/helpers.ts (финальная фикс-волна:
// раньше были продублированы в этом файле и ещё трёх спеках).
const runId = Date.now();

test.describe('POST /api/lead.php', () => {
  test('(1) валидная заявка → 200 и попадает в лог', async ({ request }) => {
    const marker = `@ivan_test_${runId}`;
    const res = await apiPost(request, { ...valid, contact: marker }, '198.51.100.1');

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const line = findLogLine(marker);
    expect(line).toBeDefined();
    expect(line).toContain('"form_type":"quiz"');
  });

  test('(2) consent:false → 400', async ({ request }) => {
    const res = await apiPost(request, { ...valid, consent: false }, '198.51.100.2');

    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'validation' });
  });

  test('(3) канал email с контактом не-почтой → 400', async ({ request }) => {
    const res = await apiPost(
      request,
      { ...valid, channel: 'email', contact: 'не-почта' },
      '198.51.100.3',
    );

    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'validation' });
  });

  test('(4) канал whatsapp требует телефон, а не произвольный ник', async ({ request }) => {
    const ip = '198.51.100.4';

    const bad = await apiPost(request, { ...valid, channel: 'whatsapp', contact: '@nik' }, ip);
    expect(bad.status()).toBe(400);
    expect(await bad.json()).toEqual({ ok: false, error: 'validation' });

    const good = await apiPost(
      request,
      { ...valid, channel: 'whatsapp', contact: '+7 916 000-00-00' },
      ip,
    );
    expect(good.status()).toBe(200);
    expect(await good.json()).toEqual({ ok: true });
  });

  test('(5) honeypot: отвечает успехом, но заявка в лог не попадает', async ({ request }) => {
    const marker = `@hp_marker_5_${runId}`;
    const res = await apiPost(request, { ...valid, hp: 'spam', contact: marker }, '198.51.100.5');

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(findLogLine(marker)).toBeUndefined();
  });

  test('(6) шестая заявка подряд с одного IP получает 429', async ({ request }) => {
    const ip = '198.51.100.6';
    const payload = { ...valid, contact: '@rl_marker_6' };

    for (let i = 0; i < 5; i++) {
      const res = await apiPost(request, payload, ip);
      expect(res.status()).toBe(200);
    }

    const sixth = await apiPost(request, payload, ip);
    expect(sixth.status()).toBe(429);
    expect(await sixth.json()).toEqual({ ok: false, error: 'rate_limit' });
  });

  test('(7) чужой Origin → 403', async ({ request }) => {
    const res = await request.post('/api/lead.php', {
      headers: { Origin: 'https://evil.example', 'X-Test-IP': '198.51.100.7' },
      data: valid,
    });

    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: 'origin' });
  });

  test('(8) GET → 405', async ({ request }) => {
    const res = await request.get('/api/lead.php');

    expect(res.status()).toBe(405);
  });

  test('(9) тело больше 64 КБ → 400', async ({ request }) => {
    const oversized = { ...valid, comment: 'x'.repeat(70_000) };
    // Явно проверяем, что реально уходит больше 65536 байт — граница из ТЗ, а не «примерно много».
    expect(Buffer.byteLength(JSON.stringify(oversized))).toBeGreaterThan(65536);

    const res = await apiPost(request, oversized, '198.51.100.9');
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'validation' });
  });

  test('(10) невалидный JSON → 400', async ({ request }) => {
    const res = await request.post('/api/lead.php', {
      headers: { Origin: 'http://127.0.0.1:4321', 'X-Test-IP': '198.51.100.10' },
      data: '{oops',
    });

    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'validation' });
  });

  test('(11) form_type qualify + client_type organizer — в логе оба поля и русские подписи', async ({
    request,
  }) => {
    const marker = `@qualify_marker_11_${runId}`;
    const res = await apiPost(
      request,
      {
        ...valid,
        form_type: 'qualify',
        services: ['complex'],
        client_type: 'organizer',
        contact: marker,
      },
      '198.51.100.11',
    );

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const line = findLogLine(marker);
    expect(line).toBeDefined();
    expect(line).toContain('"form_type":"qualify"');
    expect(line).toContain('"client_type":"organizer"');
    expect(line).toContain('Комплекс под задачу');
    expect(line).toContain('организатор мероприятий');
  });

  test('(12) неизвестный client_type не валит заявку и не подписывается в тексте', async ({
    request,
  }) => {
    const marker = `@hacker_marker_12_${runId}`;
    const res = await apiPost(
      request,
      { ...valid, client_type: 'hacker', contact: marker },
      '198.51.100.12',
    );

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const line = findLogLine(marker);
    expect(line).toBeDefined();
    // Сырой payload в логе — как прислали, включая нераспознанный client_type.
    expect(line).toContain('"client_type":"hacker"');

    const parsed = JSON.parse(line as string) as { text: string };
    for (const label of ['ивент-агентство', 'организатор мероприятий', 'компания', 'другое']) {
      expect(parsed.text).not.toContain(label);
    }
  });

  test('(13) поддомен-суффикс легитимного Origin (не точная граница) → 403', async ({
    request,
  }) => {
    // "http://127.0.0.1:4321" — валидный ПРЕФИКС строки "http://127.0.0.1:4321.evil.com", но это
    // домен атакующего, а не наш сайт с путём/портом. Проверка обязана отличать префикс-совпадение
    // от совпадения по границе URL (path/query/hash/конец строки).
    const res = await request.post('/api/lead.php', {
      headers: { Origin: 'http://127.0.0.1:4321.evil.com', 'X-Test-IP': '198.51.100.13' },
      data: valid,
    });

    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: 'origin' });
  });

  test('(14) led_size с кириллицей рядом с × не бьёт кодировку строки лога', async ({
    request,
  }) => {
    // Регресс: preg_replace('/[^0-9xX×.,]/', ...) БЕЗ модификатора /u режет байты, а не символы.
    // "×" — два байта (0xC3 0x97); без /u второй байт случайно совпадает с частью класса и
    // остаётся один, "З" (0xD0 0x97) теряет первый байт — итог невалидный UTF-8, json_encode лога
    // падает в false, в лог пишется пустая строка при формально успешном 200.
    const marker = `@led_utf8_${runId}`;
    const res = await apiPost(
      request,
      {
        ...valid,
        services: ['led'],
        details: { ...valid.details, led_size: '4×2.5З' },
        contact: marker,
      },
      '198.51.100.14',
    );

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const line = findLogLine(marker);
    expect(line).toBeDefined();
    // Если бы json_encode() вернул false из-за битого UTF-8, строки не было бы вовсе или парсинг
    // строки как JSON упал бы — это и есть доказательство целостности кодировки.
    const parsed = JSON.parse(line as string) as { text: string };
    expect(parsed.text).toContain('4×2.5 м');
  });
});
