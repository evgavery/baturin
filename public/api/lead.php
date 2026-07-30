<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$cfgPath = getenv('LEAD_CONFIG') ?: dirname(__DIR__, 2) . '/lead-config.php';
$cfg = is_file($cfgPath) ? require $cfgPath : null;
if (!is_array($cfg)) { http_response_code(500); exit(json_encode(['ok' => false, 'error' => 'config'])); }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); header('Allow: POST'); exit(json_encode(['ok' => false, 'error' => 'method'])); }

$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
// Префикс важен сам по себе: Referer всегда идёт с path после origin, точное сравнение сломало бы
// его. Но голого stripos()===0 мало — "http://a.ru.evil.com" тоже "начинается" с "http://a.ru", это
// домен атакующего. Поэтому дополнительно требуем, чтобы сразу после совпавшего префикса шла
// граница URL, а не продолжение хоста.
$allowed = rtrim((string)$cfg['allowed_origin'], '/');
// Пустой allowed_origin превратил бы проверку в «пропускать запросы без Origin/Referer».
if ($allowed === '') { http_response_code(500); exit(json_encode(['ok' => false, 'error' => 'config'])); }
$next = strlen($origin) > strlen($allowed) ? $origin[strlen($allowed)] : '';
if (stripos($origin, $allowed) !== 0 || !in_array($next, ['', '/', '?', '#'], true)) {
  http_response_code(403); exit(json_encode(['ok' => false, 'error' => 'origin']));
}

// maxlen 64К+1: тело больше лимита отбрасывается, не будучи прочитанным в память целиком.
$raw = file_get_contents('php://input', false, null, 0, 65537);
if ($raw === false || strlen($raw) > 65536) { http_response_code(400); exit(json_encode(['ok' => false, 'error' => 'validation'])); }
$d = json_decode($raw ?: '', true);
if (!is_array($d)) { http_response_code(400); exit(json_encode(['ok' => false, 'error' => 'validation'])); }

// Payload — недоверенный JSON: поле может прийти массивом/объектом вместо скаляра
// (например, channel: []). (string) на массиве кидает E_WARNING "Array to string conversion",
// который PHP допечатывает в тело ответа ПЕРЕД нашим JSON и ломает контракт ответа — поэтому
// приводим к строке только скаляры, иначе пустая строка.
$str = fn($v) => is_scalar($v) ? (string)$v : '';
// \R+ → пробел: перевод строки в свободном поле подделывал бы структурные строки уведомления
// («\nКанал: …»), которое оператор читает как доверенное.
$s = fn($k, $max) => mb_substr(trim(preg_replace('/\R+/u', ' ', $str($d[$k] ?? '')) ?? ''), 0, $max);
$hp = $str($d['hp'] ?? '');
if ($hp !== '') { exit(json_encode(['ok' => true])); } // honeypot: отвечаем успехом, ничего не делаем

$channels = ['telegram', 'whatsapp', 'max', 'email', 'call'];
$serviceKeys = ['plasma', 'led', 'touch', 'stream', 'consult', 'complex'];
$clientTypes = ['agency' => 'ивент-агентство', 'organizer' => 'организатор мероприятий', 'company' => 'компания', 'other' => 'другое'];
$name = $s('name', 100); $contact = $s('contact', 100); $channel = $str($d['channel'] ?? '');
$services = array_values(array_unique(array_intersect(array_filter((array)($d['services'] ?? []), 'is_scalar'), $serviceKeys)));
$clientType = $str($d['client_type'] ?? '');
if (!isset($clientTypes[$clientType])) { $clientType = ''; } // неизвестный тип не валит заявку
$isPhone = fn(string $v) => (bool)preg_match('/^\+?[\d\s()\-]{10,20}$/u', $v);
$contactOk = match ($channel) {
  'telegram' => (bool)preg_match('/^@\w{4,32}$/u', $contact) || $isPhone($contact),
  'whatsapp', 'max', 'call' => $isPhone($contact),
  'email' => (bool)filter_var($contact, FILTER_VALIDATE_EMAIL),
  default => false,
};
if (($d['consent'] ?? false) !== true || $name === '' || !$contactOk || !in_array($channel, $channels, true)) {
  http_response_code(400); exit(json_encode(['ok' => false, 'error' => 'validation']));
}

$ip = (!empty($cfg['test_mode']) && !empty($_SERVER['HTTP_X_TEST_IP'])) ? $_SERVER['HTTP_X_TEST_IP'] : ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
$rlFile = sys_get_temp_dir() . '/leads_rl_' . md5($ip);
$now = time(); $win = (int)$cfg['rate_limit_window'];
$hits = array_filter(is_file($rlFile) ? (array)json_decode((string)file_get_contents($rlFile), true) : [], fn($t) => $now - (int)$t < $win);
if (count($hits) >= (int)$cfg['rate_limit_max']) { http_response_code(429); header('Retry-After: ' . $win); exit(json_encode(['ok' => false, 'error' => 'rate_limit'])); }
$hits[] = $now; file_put_contents($rlFile, json_encode(array_values($hits)), LOCK_EX);

$det = (array)($d['details'] ?? []);
// Диагонали — по whitelist значений формы, размер LED — по символам и длине: недоверенные
// details не должны раздувать уведомление за телеграмный лимит 4096 или подделывать его строки.
$diagonals = array_values(array_unique(array_intersect(array_map($str, (array)($det['diagonals'] ?? [])), ['55', '75', '86', '98', 'other'])));
$ledSize = mb_substr((string)preg_replace('/[^0-9xX×.,]/u', '', $str($det['led_size'] ?? '')), 0, 20);
$what = [];
if ($services) {
  $names = ['plasma' => 'Плазменные панели', 'led' => 'LED-экран', 'touch' => 'Тач-панели', 'stream' => 'Видеотрансляция', 'consult' => 'Нужна консультация', 'complex' => 'Комплекс под задачу'];
  foreach ($services as $sv) {
    $line = $names[$sv];
    if ($sv === 'plasma' && $diagonals) $line .= ' ' . implode('″, ', $diagonals) . '″' . (!empty($det['qty']) ? ' ×' . (int)$det['qty'] : '');
    if ($sv === 'led' && $ledSize !== '') $line .= ' ' . $ledSize . ' м' . (!empty($det['outdoor']) ? ' (outdoor)' : ' (indoor)');
    $what[] = $line;
  }
}
$utm = (array)($d['utm'] ?? []);
$utmStr = implode('-', array_filter([mb_substr($str($utm['source'] ?? ''), 0, 100), mb_substr($str($utm['medium'] ?? ''), 0, 100), mb_substr($str($utm['campaign'] ?? ''), 0, 100)]));
$ftLabels = ['short' => 'форма', 'qualify' => 'подбор'];
$text = "🟢 Заявка с сайта (" . ($ftLabels[$s('form_type', 10)] ?? 'квиз') . ")\n"
  . "Что: " . ($what ? implode('; ', $what) : '—') . "\n"
  . "Когда: " . implode(', ', array_filter([$s('date', 20), $s('duration', 30), $s('venue', 200)])) . "\n"
  . "Кто: " . implode(', ', array_filter([$name, $s('company', 200), $clientType !== '' ? $clientTypes[$clientType] : ''])) . "\n"
  . "Канал: {$channel} → {$contact}\n"
  . ($s('comment', 500) !== '' ? "Комментарий: " . $s('comment', 500) . "\n" : '')
  . "Источник: " . $s('page', 100) . ($utmStr ? " · utm: {$utmStr}" : '');

if (!empty($cfg['test_mode'])) {
  @mkdir(dirname($cfg['test_log']), 0777, true);
  file_put_contents($cfg['test_log'], json_encode(['payload' => $d, 'text' => $text], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
  exit(json_encode(['ok' => true]));
}

$tgOk = false;
if ($cfg['tg_bot_token'] && $cfg['tg_chat_id']) {
  $ch = curl_init("https://api.telegram.org/bot{$cfg['tg_bot_token']}/sendMessage");
  curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5,
    CURLOPT_POSTFIELDS => http_build_query(['chat_id' => $cfg['tg_chat_id'], 'text' => $text])]);
  $tgOk = curl_exec($ch) !== false && curl_getinfo($ch, CURLINFO_RESPONSE_CODE) === 200;
  curl_close($ch);
}
$host = parse_url($cfg['allowed_origin'], PHP_URL_HOST) ?: 'localhost';
$mailOk = @mail($cfg['lead_email'], '=?UTF-8?B?' . base64_encode('Заявка с сайта') . '?=',
  $text, "From: robot@{$host}\r\nContent-Type: text/plain; charset=utf-8");
// Без payload в логе: на shared-хостинге error_log нередко лежит в webroot и читается по HTTP —
// ПДн заявки туда попадать не должны.
if (!$tgOk && !$mailOk) {
  error_log('lead.php: заявка не доставлена ни в TG, ни на почту (form_type=' . $s('form_type', 10) . ', page=' . $s('page', 100) . ')');
  // Честная ошибка вместо ok:true: фронт покажет экран «не получилось» с прямыми контактами,
  // молча потерянных заявок быть не должно.
  http_response_code(502); exit(json_encode(['ok' => false, 'error' => 'delivery']));
}
if (!$tgOk) error_log('lead.php: telegram недоступен, ушло только письмо');

exit(json_encode(['ok' => true]));
