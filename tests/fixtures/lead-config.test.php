<?php
/**
 * Тестовый конфиг для public/api/lead.php — используется Playwright'ом (playwright.config.ts
 * прокидывает LEAD_CONFIG на этот файл в webServer.env) как для API-тестов lead-api.spec.ts,
 * так и для будущих браузерных тестов форм/квиза (Tasks 11–12).
 *
 * test_mode=true: заявки не уходят в Telegram/почту, а пишутся JSON-строками в test_log —
 * это НЕ образец для боевого конфига, см. lead-config.example.php.
 */
return [
  'tg_bot_token' => '', // не используется: test_mode=true не доходит до отправки в Telegram
  'tg_chat_id' => '',
  'lead_email' => 'leads@example.ru',
  'allowed_origin' => 'http://127.0.0.1:4321', // локальный стенд, playwright.config.ts
  'rate_limit_max' => 5,
  // Секунды, не час: кейс лимита шлёт 6 POST мгновенно и должен словить 429 в пределах теста,
  // а обычные отправки форм/квиза в других спеках разнесены по времени и в это окно не попадают.
  'rate_limit_window' => 2,
  'test_mode' => true,
  'test_log' => __DIR__ . '/../.tmp/leads.log',
];
