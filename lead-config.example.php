<?php
/**
 * Образец конфига для public/api/lead.php (приём заявок, ТЗ §6.4).
 *
 * Как разворачивать на боевом хостинге (Reg.ru, shared):
 * 1. Скопировать этот файл под именем `lead-config.php`.
 * 2. Заполнить реальные значения ниже (см. TODO).
 * 3. Положить файл НА УРОВЕНЬ ВЫШЕ webroot — рядом с папкой, куда распакован dist/,
 *    а НЕ внутрь неё, чтобы файл был недоступен по HTTP. lead.php ищет его сам по пути
 *    `dirname(__DIR__, 2) . '/lead-config.php'` (webroot/api/lead.php → на два уровня выше).
 * 4. Путь можно переопределить переменной окружения LEAD_CONFIG (используется в dev/тестах —
 *    см. playwright.config.ts и tests/fixtures/lead-config.test.php; эту тестовую фикстуру
 *    в бою не использовать).
 *
 * lead-config.php с реальными токенами — В РЕПОЗИТОРИЙ НЕ КОММИТИТЬ (файл в .gitignore).
 */
return [
  'tg_bot_token' => '',            // TODO: реальные данные клиента (ТЗ §8.2 п.7)
  'tg_chat_id' => '',              // TODO: реальные данные клиента (ТЗ §8.2 п.7)
  'lead_email' => 'leads@example.ru', // TODO: реальные данные клиента
  'allowed_origin' => 'https://screenrent-placeholder.ru', // TODO: реальный домен (ТЗ §8.2 п.1)
  'rate_limit_max' => 5,
  'rate_limit_window' => 3600,
  // ВНИМАНИЕ: true отключает отправку в Telegram и на почту — заявки просто пишутся
  // JSON-строками в test_log. На боевом сервере ЗНАЧЕНИЕ ДОЛЖНО БЫТЬ false, иначе
  // реальные заявки клиентов не будут доставляться.
  'test_mode' => false,
  'test_log' => __DIR__ . '/../.tmp/leads.log', // используется только при test_mode=true
];
