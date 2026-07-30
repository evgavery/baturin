// Чистая логика квиза (ТЗ §6.1, §6.4): состояние, валидация контакта, ошибки шага, payload.
// Без DOM и побочных эффектов.

/** Канал связи — те же 5 значений, что принимает public/api/lead.php. */
export type Channel = 'telegram' | 'whatsapp' | 'max' | 'email' | 'call';

/** Позиция интереса. 'complex' — только форма подбора, в квизе не участвует. */
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
 * Посимвольная копия $isPhone из public/api/lead.php (JS-модификатора /u нет намеренно).
 * Известная асимметрия \s: JS считает пробелом U+FEFF, PCRE(/u) — U+0085; оба направления
 * не пропускают на фронте то, что отбил бы сервер, невидимые символы внутри строки чистит
 * stripInvisible на вводе.
 */
function isPhone(v: string): boolean {
  return /^\+?[\d\s()\-]{10,20}$/.test(v);
}

/**
 * Зеркало PHP trim() без аргументов — ровно 6 символов. Нативный String.trim() шире (срезает
 * NBSP, BOM и другие юникод-пробелы): контакт, «очищенный» им на фронте, сервер получил бы
 * необрезанным и отбил бы уже принятую заявку.
 */
function phpTrim(v: string): string {
  return v.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

/**
 * Зеркало серверного $contactOk из public/api/lead.php: те же регексы над тем же trim()-нутым
 * значением. Payload уходит с исходным contact — сервер применит свой trim() сам. Email
 * упрощён намеренно: сервер перепроверяет через filter_var(FILTER_VALIDATE_EMAIL).
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
  // Шаг 2 — все поля необязательные (ТЗ §6.1), ошибок не бывает.

  return errors;
}

function ledSize(w: number | null, h: number | null): string | undefined {
  return w !== null && h !== null ? `${w}x${h}` : undefined;
}

/** Payload по схеме ТЗ §6.4 — единственное место, где формируется тело запроса квиза. */
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
