// Чистая логика квиза (ТЗ §6.1, §6.4): состояние, валидация контакта, ошибки шага, payload.
// Без DOM и побочных эффектов — модуль напрямую юнит-тестируется, а UI-слой (Task 11) использует
// эти функции как единственный источник правды о том, что можно отправлять на сервер.

/** Канал связи для получения сметы — те же 5 значений, что принимает public/api/lead.php. */
export type Channel = 'telegram' | 'whatsapp' | 'max' | 'email' | 'call';

/** Позиция интереса. 'complex' — только форма подбора (Task 12), в квизе шага 1 не участвует. */
export type ServiceKey = 'plasma' | 'led' | 'touch' | 'stream' | 'consult' | 'complex';

/** Кто обращается — необязательное уточнение на шаге 3. */
export type ClientType = 'agency' | 'organizer' | 'company' | 'other';

export interface QuizState {
  step: 1 | 2 | 3;
  services: ServiceKey[];
  diagonals: string[];
  qty: number;
  ledW: number | null;
  ledH: number | null;
  outdoor: boolean;
  date: string;
  duration: string;
  venue: string;
  comment: string;
  name: string;
  company: string;
  clientType: ClientType | null;
  channel: Channel | null;
  contact: string;
  consent: boolean;
}

export interface Utm {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
}

/** Пустое состояние квиза (шаг 1, ничего не выбрано) с точечным мержем предвыбора с карточки. */
export function initialState(preset?: Partial<QuizState>): QuizState {
  return {
    step: 1,
    services: [],
    diagonals: [],
    qty: 1,
    ledW: null,
    ledH: null,
    outdoor: false,
    date: '',
    duration: '',
    venue: '',
    comment: '',
    name: '',
    company: '',
    clientType: null,
    channel: null,
    contact: '',
    consent: false,
    ...preset,
  };
}

/**
 * Телефон — общий формат для WhatsApp/MAX/звонка и как запасной вариант для Telegram.
 * Регекс — посимвольная копия $isPhone из public/api/lead.php (без завершающего модификатора
 * /u — в JS у него другой смысл). \d и большинство \s-кейсов ведут себя одинаково в PCRE(/u) и
 * в JS (проверено эмпирически: php -r / node -e, не по памяти), но есть подтверждённая
 * асимметрия символьных классов: JS-\s считает пробелом U+FEFF (BOM), PHP-\s(/u) — нет (и
 * PHP-trim() его тоже не срезает); для U+0085 (NEL) — наоборот, PHP-\s считает пробелом, JS —
 * нет (это безопасное направление: фронт строже сервера). Если U+FEFF окажется ВНУТРИ строки
 * контакта (не на краю, где его срезал бы phpTrim), фронт формально примет символ как часть
 * телефона, а сервер — нет. Нормализация невидимых юникод-пробелов внутри строки — вне скоупа
 * этого модуля (Task 11, уровень UI/инпута).
 */
function isPhone(v: string): boolean {
  return /^\+?[\d\s()\-]{10,20}$/.test(v);
}

/**
 * Зеркало PHP trim() без аргументов: срезает по краям те же 6 символов, что и PHP по умолчанию —
 * пробел, \t, \n, \r, NUL, вертикальную табуляцию (проверено эмпирически на PHP 8.5, посимвольно).
 * Нативный JS String.trim() здесь НЕ годится: он шире PHP (дополнительно срезает NBSP U+00A0,
 * BOM U+FEFF и другие юникод-пробелы). Это открыло бы обратную дыру: невидимый U+FEFF на краю
 * контакта фронт срезал бы (наивным .trim()) и принял бы чистый номер, а lead.php получил бы
 * тот же контакт БЕЗ обрезки (его trim() до U+FEFF не касается) и отбил бы уже готовую заявку.
 * Управляющие символы в классе — намеренные (это буквально алфавит PHP trim()), не опечатка.
 */
function phpTrim(v: string): string {
  return v.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

/**
 * Зеркало серверной проверки контакта из public/api/lead.php ($contactOk): те же регексы для
 * telegram/whatsapp/max/call, посимвольно (кроме модификатора /u, которого у JS-регексов нет),
 * над тем же trim()-нутым значением — lead.php валидирует `trim($str($d['contact'] ?? ''))`,
 * а не сырой ввод; без этого шага краевой пробел меняет длину строки по-разному на фронте и на
 * сервере (например, 9 цифр + пробел проходят фронтовую проверку {10,20}, но после серверного
 * trim() остаются 9 цифрами и получают отказ — заявка, принятая тут, теряется на сервере).
 * Payload при этом уходит с исходным (нетримленным) contact — сервер сам применит тот же trim().
 * Email — намеренно упрощённая проверка (по брифу задачи): сервер отдельно перепроверяет
 * через filter_var(FILTER_VALIDATE_EMAIL), который строже простого регекса.
 */
export function validateContact(channel: Channel, contact: string): boolean {
  const v = phpTrim(contact);
  switch (channel) {
    case 'telegram':
      return /^@\w{4,32}$/.test(v) || isPhone(v);
    case 'whatsapp':
    case 'max':
    case 'call':
      return isPhone(v);
    case 'email':
      return /^\S+@\S+\.\S+$/.test(v);
    default:
      return false;
  }
}

/** Ошибки текущего шага; пустой массив — можно переходить дальше или отправлять форму. */
export function stepErrors(s: QuizState): string[] {
  const errors: string[] = [];

  if (s.step === 1) {
    if (s.services.length === 0) errors.push('Выберите, что нужно');
    if (s.services.includes('plasma')) {
      if (s.diagonals.length === 0) errors.push('Выберите диагональ панели');
      if (s.qty < 1) errors.push('Укажите количество панелей');
    }
  } else if (s.step === 3) {
    if (s.name.trim() === '') errors.push('Укажите имя');
    if (s.channel === null) {
      errors.push('Выберите канал связи');
    } else if (!validateContact(s.channel, s.contact)) {
      errors.push('Проверьте контакт — он не подходит для выбранного канала');
    }
    if (s.consent !== true) errors.push('Отметьте согласие на обработку данных');
  }
  // Шаг 2 (когда и где) — все поля необязательные по ТЗ §6.1, ошибок не бывает.

  return errors;
}

/** LED-размер для payload: "ШxВ" в метрах, точка — разделитель дробной части (ТЗ §6.4). */
function ledSize(w: number | null, h: number | null): string | undefined {
  return w !== null && h !== null ? `${w}x${h}` : undefined;
}

/** Собирает payload по схеме ТЗ §6.4. Единственное место, где формируется тело запроса квиза. */
export function toPayload(s: QuizState, page: string, utm: Utm | null, hp: string): object {
  const size = ledSize(s.ledW, s.ledH);
  const details: { diagonals: string[]; qty: number; outdoor: boolean; led_size?: string } = {
    diagonals: s.diagonals,
    qty: s.qty,
    outdoor: s.outdoor,
    ...(size !== undefined ? { led_size: size } : {}),
  };

  return {
    form_type: 'quiz',
    services: s.services,
    details,
    date: s.date,
    duration: s.duration,
    venue: s.venue,
    comment: s.comment,
    name: s.name,
    company: s.company,
    client_type: s.clientType ?? '',
    channel: s.channel ?? '',
    contact: s.contact,
    consent: s.consent,
    page,
    utm: utm ?? { source: '', medium: '', campaign: '', content: '', term: '' },
    hp,
  };
}
