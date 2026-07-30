import { describe, expect, it } from 'vitest';
import { initialState, stepErrors, toPayload, validateContact, type QuizState, type Utm } from './quiz-core';

// validateContact — зеркало серверных регексов из public/api/lead.php ($contactOk): расхождение
// значит, что заявка проходит фронт и отбивается сервером — пользователь потерян. В кейсах —
// и граничные значения диапазонов длины: главный риск при посимвольном копировании.
describe('validateContact: telegram', () => {
  it('@ник из 4+ символов — валиден', () => {
    expect(validateContact('telegram', '@ivan_t')).toBe(true);
  });

  it('текст без @ и не телефон — невалиден', () => {
    expect(validateContact('telegram', 'ваня')).toBe(false);
  });

  it('телефон тоже принимается для telegram (запасной канал звонка)', () => {
    expect(validateContact('telegram', '+7 916 123-45-67')).toBe(true);
  });

  it('граница ника: 3 символа после @ — мало (минимум 4)', () => {
    expect(validateContact('telegram', '@abc')).toBe(false);
  });

  it('граница ника: 4 символа после @ — минимум, валиден', () => {
    expect(validateContact('telegram', '@abcd')).toBe(true);
  });

  it('граница ника: 32 символа после @ — максимум, валиден', () => {
    expect(validateContact('telegram', '@' + 'a'.repeat(32))).toBe(true);
  });

  it('граница ника: 33 символа после @ — превышение, невалиден', () => {
    expect(validateContact('telegram', '@' + 'a'.repeat(33))).toBe(false);
  });
});

describe('validateContact: whatsapp/max/call — только телефон', () => {
  it('whatsapp принимает телефон', () => {
    expect(validateContact('whatsapp', '+79161234567')).toBe(true);
  });

  it('whatsapp не принимает произвольный ник', () => {
    expect(validateContact('whatsapp', '@ivan')).toBe(false);
  });

  it('call принимает 10+ цифр без плюса', () => {
    expect(validateContact('call', '89161234567')).toBe(true);
  });

  it('max принимает телефон с пробелами и скобками', () => {
    expect(validateContact('max', '+7 (916) 123-45-67')).toBe(true);
  });

  it('граница телефона: 9 значащих символов — мало (минимум 10)', () => {
    expect(validateContact('call', '123456789')).toBe(false);
  });

  it('граница телефона: 10 значащих символов — минимум, валиден', () => {
    expect(validateContact('call', '1234567890')).toBe(true);
  });

  it('граница телефона: 20 символов — максимум, валиден', () => {
    expect(validateContact('call', '1'.repeat(20))).toBe(true);
  });

  it('граница телефона: 21 символ — превышение, невалиден', () => {
    expect(validateContact('call', '1'.repeat(21))).toBe(false);
  });
});

// lead.php перед сверкой с регексом делает trim($contact) ($s = fn($k,$max) => mb_substr(trim(...))).
// Если фронт валидирует СЫРОЙ contact без такого же trim, краевой пробел по-разному меняет длину
// строки на фронте и на сервере — заявка молча проходит фронт и отбивается сервером.
describe('validateContact: зеркало PHP trim() перед проверкой', () => {
  it('9 цифр + завершающий пробел: сервер после trim() видит 9 цифр — невалиден', () => {
    expect(validateContact('call', '916123456 ')).toBe(false);
  });

  it('ведущий пробел перед валидным номером — после trim() валиден', () => {
    expect(validateContact('call', ' +79161234567')).toBe(true);
  });
});

describe('validateContact: email', () => {
  it('адрес с точкой в домене — валиден', () => {
    expect(validateContact('email', 'a@b.ru')).toBe(true);
  });

  it('без точки в домене — невалиден', () => {
    expect(validateContact('email', 'a@b')).toBe(false);
  });
});

describe('stepErrors: шаг 1 — что нужно', () => {
  it('пустые services — ошибка с закреплённым текстом (защита от дрейфа формулировки)', () => {
    const s = initialState();
    expect(stepErrors(s)).toEqual(['Выберите, что нужно']);
  });

  it('plasma без диагоналей — ошибка', () => {
    const s = initialState({ services: ['plasma'], diagonals: [] });
    expect(stepErrors(s).length).toBeGreaterThan(0);
  });

  it('plasma с диагональю, но qty=0 — ошибка', () => {
    const s = initialState({ services: ['plasma'], diagonals: ['75'], qty: 0 });
    expect(stepErrors(s).length).toBeGreaterThan(0);
  });

  it('plasma с диагональю и дефолтным qty — можно дальше', () => {
    const s = initialState({ services: ['plasma'], diagonals: ['75'] });
    expect(stepErrors(s)).toEqual([]);
  });

  it('услуга без подшага (led) — можно дальше без доп. полей', () => {
    const s = initialState({ services: ['led'] });
    expect(stepErrors(s)).toEqual([]);
  });
});

describe('stepErrors: шаг 2 — всегда пусто', () => {
  it('пустое состояние на шаге 2 не даёт ошибок (все поля шага необязательны)', () => {
    const s = initialState({ step: 2 });
    expect(stepErrors(s)).toEqual([]);
  });
});

describe('stepErrors: шаг 3 — куда прислать смету', () => {
  const validStep3: Partial<QuizState> = {
    step: 3,
    name: 'Иван',
    channel: 'telegram',
    contact: '@ivan_t',
    consent: true,
  };

  it('без согласия — ошибка с закреплённым текстом (защита от дрейфа формулировки)', () => {
    const s = initialState({ ...validStep3, consent: false });
    expect(stepErrors(s)).toEqual(['Отметьте согласие на обработку данных']);
  });

  it('валидный шаг 3 — пустой список ошибок', () => {
    const s = initialState(validStep3);
    expect(stepErrors(s)).toEqual([]);
  });

  it('пустое имя — ошибка', () => {
    const s = initialState({ ...validStep3, name: '   ' });
    expect(stepErrors(s).length).toBeGreaterThan(0);
  });

  it('канал не выбран — ошибка', () => {
    const s = initialState({ ...validStep3, channel: null });
    expect(stepErrors(s).length).toBeGreaterThan(0);
  });

  it('контакт не подходит выбранному каналу — ошибка', () => {
    const s = initialState({ ...validStep3, channel: 'whatsapp', contact: '@ivan_t' });
    expect(stepErrors(s).length).toBeGreaterThan(0);
  });
});

describe('initialState', () => {
  it('дефолты пустого состояния', () => {
    expect(initialState()).toEqual<QuizState>({
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
    });
  });

  it('preset мержится поверх дефолтов, не заданные в preset поля остаются дефолтными', () => {
    const s = initialState({ services: ['plasma'], diagonals: ['75'] });
    expect(s.services).toEqual(['plasma']);
    expect(s.diagonals).toEqual(['75']);
    expect(s.qty).toBe(1);
    expect(s.step).toBe(1);
  });
});

// Локальная форма payload — только то, что проверяют тесты (полная схема — ТЗ §6.4 / lead-api.spec.ts).
// toPayload возвращает `object`; для type-safe чтения полей в тесте кастуем
// в этот узкий интерфейс (не any, не двойной каст: object → более узкий тип — валидное сужение).
interface QuizPayload {
  form_type: string;
  services: string[];
  details: { diagonals: string[]; qty: number; outdoor: boolean; led_size?: string };
  client_type: string;
  channel: string;
  page: string;
  utm: Utm;
  hp: string;
}

describe('toPayload', () => {
  it('form_type всегда "quiz"', () => {
    const payload = toPayload(initialState(), '/', null, '') as QuizPayload;
    expect(payload.form_type).toBe('quiz');
  });

  it('led_size собирается из ledW/ledH через "x", точка — разделитель дробной части', () => {
    const s = initialState({ services: ['led'], ledW: 4, ledH: 2.5 });
    const payload = toPayload(s, '/led-ekrany/', null, '') as QuizPayload;
    expect(payload.details.led_size).toBe('4x2.5');
  });

  it('led_size отсутствует, если задана только одна сторона', () => {
    const s = initialState({ services: ['led'], ledW: 4, ledH: null });
    const payload = toPayload(s, '/', null, '') as QuizPayload;
    expect(payload.details.led_size).toBeUndefined();
  });

  it('led_size отсутствует, если размеры не заданы вовсе', () => {
    const payload = toPayload(initialState(), '/', null, '') as QuizPayload;
    expect(payload.details.led_size).toBeUndefined();
  });

  it('utm и page на месте, hp прокинут', () => {
    const utm: Utm = { source: 'direct', medium: 'cpc', campaign: 'led', content: '', term: '' };
    const payload = toPayload(initialState(), '/led-ekrany/', utm, 'trap-value') as QuizPayload;
    expect(payload.page).toBe('/led-ekrany/');
    expect(payload.utm).toEqual(utm);
    expect(payload.hp).toBe('trap-value');
  });

  it('utm:null → все поля utm пустыми строками (не теряем поле для сервера)', () => {
    const payload = toPayload(initialState(), '/', null, '') as QuizPayload;
    expect(payload.utm).toEqual({ source: '', medium: '', campaign: '', content: '', term: '' });
  });

  it('client_type — пустая строка, если clientType: null', () => {
    const payload = toPayload(initialState(), '/', null, '') as QuizPayload;
    expect(payload.client_type).toBe('');
  });

  it('client_type — код выбранного типа клиента', () => {
    const s = initialState({ clientType: 'agency' });
    const payload = toPayload(s, '/', null, '') as QuizPayload;
    expect(payload.client_type).toBe('agency');
  });

  it('channel — пустая строка, если не выбран (канал ещё не выбран на момент вызова)', () => {
    const payload = toPayload(initialState(), '/', null, '') as QuizPayload;
    expect(payload.channel).toBe('');
  });
});
