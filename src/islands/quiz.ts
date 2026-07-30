// Квиз «Получить смету»: рендер state в DOM, ввод, sessionStorage, отправка. Валидация и
// payload — в quiz-core. Грузится лениво по первому клику на [data-quiz-open] (см. app.ts) —
// в eager-бандл попадать не должен.
import { loadUtm, stripInvisible } from './form-utils';
import { reachGoal } from './goals';
import {
  initialState,
  stepErrors,
  toPayload,
  type Channel,
  type ClientType,
  type QuizState,
  type ServiceKey,
} from './quiz-core';

const STATE_KEY = 'quiz_state_v1';

// Неразрывные пробелы — как в серверной разметке QuizModal.astro: лейбл в узкой колонке
// у крестика не должен переноситься после первого же render().
const STEP_LABELS: Record<1 | 2 | 3, string> = {
  1: 'ШАГ 1 ИЗ 3 · ОБОРУДОВАНИЕ',
  2: 'ШАГ 2 ИЗ 3 · ДАТЫ И ПЛОЩАДКА',
  3: 'ШАГ 3 ИЗ 3 · КОНТАКТ',
};

const CHANNEL_UX: Record<Channel, { placeholder: string; inputMode: 'text' | 'tel' | 'email' }> = {
  telegram: { placeholder: '@ник или телефон', inputMode: 'text' },
  whatsapp: { placeholder: '+7 …', inputMode: 'tel' },
  max: { placeholder: '+7 …', inputMode: 'tel' },
  call: { placeholder: '+7 …', inputMode: 'tel' },
  email: { placeholder: 'почта', inputMode: 'email' },
};
const CHANNEL_UX_DEFAULT = { placeholder: 'Телефон, ник или e-mail', inputMode: 'text' as const };

function successText(channel: Channel | null): string {
  switch (channel) {
    case 'telegram':
      return 'Заявка у нас. Смета придёт в Telegram в течение 30 минут.';
    case 'whatsapp':
      return 'Заявка у нас. Смета придёт в WhatsApp в течение 30 минут.';
    case 'max':
      return 'Заявка у нас. Смета придёт в MAX в течение 30 минут.';
    case 'email':
      return 'Заявка у нас. Смета придёт на почту в течение 30 минут.';
    case 'call':
    default:
      return 'Заявка у нас. Позвоним вам в течение 30 минут.';
  }
}

/** sessionStorage недоступен в приватном режиме Safari — работаем без него. */
function readStore(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}
function removeStore(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function numOrNull(v: number): number | null {
  return Number.isFinite(v) ? v : null;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string');
}

// Whitelist-значения как данные: в quiz-core Channel/ClientType — только типы, в рантайме их
// нет. satisfies Record<…> держит списки полными: расширили тип — компилятор требует пополнить
// запись, иначе сохранённое состояние с новым значением молча отбрасывалось бы.
const CHANNEL_VALUES = Object.keys({
  telegram: 1,
  whatsapp: 1,
  max: 1,
  email: 1,
  call: 1,
} satisfies Record<Channel, 1>) as readonly Channel[];
// Без 'complex': в квизе этой услуги нет (только в форме подбора), полнота тут не нужна.
const SERVICE_VALUES = ['plasma', 'led', 'touch', 'stream', 'consult'] as const satisfies readonly ServiceKey[];
const CLIENT_TYPE_VALUES = Object.keys({
  agency: 1,
  organizer: 1,
  company: 1,
  other: 1,
} satisfies Record<ClientType, 1>) as readonly ClientType[];
const DIAGONAL_VALUES = ['55', '75', '86', '98', 'other'] as const;

function isChannel(v: unknown): v is Channel {
  return typeof v === 'string' && (CHANNEL_VALUES as readonly string[]).includes(v);
}

function isClientType(v: unknown): v is ClientType {
  return typeof v === 'string' && (CLIENT_TYPE_VALUES as readonly string[]).includes(v);
}

/**
 * Сырое из sessionStorage/data-preset спредится поверх дефолтов, поэтому неверная форма поля
 * роняет не open, а первое взаимодействие (например, services-строка ломает .filter), а чужое
 * значение channel добиралось бы до CHANNEL_UX[channel] и роняло render() ещё до showModal() —
 * с испорченным стораджем квиз не открывался бы вовсе. Всё неподходящее по типу/значению
 * отбрасываем до дефолта, не пытаясь чинить.
 */
function sanitizePartialState(raw: Record<string, unknown>): Partial<QuizState> {
  const out: Partial<QuizState> = {};
  if (raw.step === 1 || raw.step === 2 || raw.step === 3) out.step = raw.step;
  if (isStringArray(raw.services)) {
    out.services = raw.services.filter((v): v is ServiceKey =>
      (SERVICE_VALUES as readonly string[]).includes(v),
    );
  }
  if (isStringArray(raw.diagonals)) {
    out.diagonals = raw.diagonals.filter((v) => (DIAGONAL_VALUES as readonly string[]).includes(v));
  }
  if (typeof raw.qty === 'number' && Number.isFinite(raw.qty)) out.qty = raw.qty;
  if (raw.ledW === null || (typeof raw.ledW === 'number' && Number.isFinite(raw.ledW))) {
    out.ledW = raw.ledW as number | null;
  }
  if (raw.ledH === null || (typeof raw.ledH === 'number' && Number.isFinite(raw.ledH))) {
    out.ledH = raw.ledH as number | null;
  }
  if (typeof raw.outdoor === 'boolean') out.outdoor = raw.outdoor;
  if (typeof raw.date === 'string') out.date = raw.date;
  if (typeof raw.duration === 'string') out.duration = raw.duration;
  if (typeof raw.venue === 'string') out.venue = raw.venue;
  if (typeof raw.comment === 'string') out.comment = raw.comment;
  if (typeof raw.name === 'string') out.name = raw.name;
  if (typeof raw.company === 'string') out.company = raw.company;
  if (raw.clientType === null || isClientType(raw.clientType)) {
    out.clientType = raw.clientType as ClientType | null;
  }
  if (raw.channel === null || isChannel(raw.channel)) out.channel = raw.channel as Channel | null;
  if (typeof raw.contact === 'string') out.contact = raw.contact;
  if (typeof raw.consent === 'boolean') out.consent = raw.consent;
  return out;
}

function loadSavedState(): Partial<QuizState> {
  const raw = readStore(STATE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? sanitizePartialState(parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parsePreset(presetJson: string | undefined): Partial<QuizState> {
  if (!presetJson) return {};
  try {
    const parsed: unknown = JSON.parse(presetJson);
    return parsed && typeof parsed === 'object' ? sanitizePartialState(parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

interface Refs {
  dialog: HTMLDialogElement;
  form: HTMLFormElement;
  formView: HTMLElement;
  closeBtn: HTMLButtonElement;
  stepLabel: HTMLElement;
  progress: HTMLElement;
  segments: HTMLElement[];
  steps: Record<1 | 2 | 3, HTMLElement>;
  subPlasma: HTMLElement;
  subLed: HTMLElement;
  qtyInput: HTMLInputElement;
  ledWInput: HTMLInputElement;
  ledHInput: HTMLInputElement;
  outdoorInput: HTMLInputElement;
  dateInput: HTMLInputElement;
  dateUnknown: HTMLInputElement;
  venueInput: HTMLInputElement;
  commentInput: HTMLTextAreaElement;
  nameInput: HTMLInputElement;
  companyInput: HTMLInputElement;
  clientTypeSelect: HTMLSelectElement;
  contactInput: HTMLInputElement;
  consentInput: HTMLInputElement;
  hpInput: HTMLInputElement;
  errorsBox: HTMLElement;
  backBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  successScreen: HTMLElement;
  successText: HTMLElement;
  errorScreen: HTMLElement;
  retryBtn: HTMLButtonElement;
}

function req<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`QuizModal: не найден элемент "${selector}"`);
  return el;
}

let initialized = false;
let refs: Refs;
let state: QuizState = initialState();
let lastFocused: HTMLElement | null = null;
let submitting = false;
// Растёт на каждую отправку и на каждое openQuiz(): ответ fetch из прежней сессии квиза
// не должен подменить экран текущей — токен сверяется перед любым касанием DOM.
let submitToken = 0;

function queryRefs(): Refs {
  const dialog = req<HTMLDialogElement>(document, '#quiz');
  const form = req<HTMLFormElement>(dialog, '#quiz-form');
  return {
    dialog,
    form,
    formView: req(form, '[data-form-view]'),
    closeBtn: req(dialog, '[data-close]'),
    stepLabel: req(form, '[data-step-label]'),
    progress: req(form, '[data-progress]'),
    segments: Array.from(form.querySelectorAll<HTMLElement>('[data-segment]')),
    steps: {
      1: req(form, '[data-step="1"]'),
      2: req(form, '[data-step="2"]'),
      3: req(form, '[data-step="3"]'),
    },
    subPlasma: req(form, '[data-sub="plasma"]'),
    subLed: req(form, '[data-sub="led"]'),
    qtyInput: req(form, 'input[name="qty"]'),
    ledWInput: req(form, 'input[name="ledW"]'),
    ledHInput: req(form, 'input[name="ledH"]'),
    outdoorInput: req(form, 'input[name="outdoor"]'),
    dateInput: req(form, 'input[name="date"]'),
    dateUnknown: req(form, '[data-date-unknown]'),
    venueInput: req(form, 'input[name="venue"]'),
    commentInput: req(form, 'textarea[name="comment"]'),
    nameInput: req(form, 'input[name="name"]'),
    companyInput: req(form, 'input[name="company"]'),
    clientTypeSelect: req(form, 'select[name="client_type"]'),
    contactInput: req(form, 'input[name="contact"]'),
    consentInput: req(form, 'input[name="consent"]'),
    hpInput: req(form, 'input[name="website"]'),
    errorsBox: req(form, '[data-errors]'),
    backBtn: req(form, '[data-action="back"]'),
    nextBtn: req(form, '[data-action="next"]'),
    successScreen: req(form, '[data-screen="success"]'),
    successText: req(form, '[data-success-text]'),
    errorScreen: req(form, '[data-screen="error"]'),
    retryBtn: req(form, '[data-action="retry"]'),
  };
}

function persist(): void {
  writeStore(STATE_KEY, JSON.stringify(state));
}

function applyChannelUx(channel: Channel | null): void {
  const cfg = channel ? CHANNEL_UX[channel] : CHANNEL_UX_DEFAULT;
  refs.contactInput.placeholder = cfg.placeholder;
  refs.contactInput.inputMode = cfg.inputMode;
}

// [data-errors] всегда в DOM: live-регион, появившийся одновременно с текстом, скринридеры
// не анонсируют. Управляем только textContent; пустая строка схлопывается через :empty.
function showErrors(errors: string[]): void {
  refs.errorsBox.textContent = errors.join('\n');
}

function hideErrors(): void {
  refs.errorsBox.textContent = '';
}

/** Полный рендер state в DOM: видимость шагов, прогресс, значения всех полей. */
function render(): void {
  refs.stepLabel.textContent = STEP_LABELS[state.step];
  refs.progress.setAttribute('aria-valuenow', String(state.step));
  refs.progress.setAttribute('aria-label', `Шаг ${state.step} из 3`);
  refs.segments.forEach((segment, index) => {
    segment.classList.toggle('is-filled', index < state.step);
  });

  refs.steps[1].hidden = state.step !== 1;
  refs.steps[2].hidden = state.step !== 2;
  refs.steps[3].hidden = state.step !== 3;

  refs.form.querySelectorAll<HTMLInputElement>('input[name="services"]').forEach((cb) => {
    cb.checked = state.services.includes(cb.value as ServiceKey);
  });
  refs.subPlasma.hidden = !state.services.includes('plasma');
  refs.subLed.hidden = !state.services.includes('led');
  refs.form.querySelectorAll<HTMLInputElement>('input[name="diagonals"]').forEach((cb) => {
    cb.checked = state.diagonals.includes(cb.value);
  });
  refs.qtyInput.value = state.qty > 0 ? String(state.qty) : '';
  refs.ledWInput.value = state.ledW !== null ? String(state.ledW) : '';
  refs.ledHInput.value = state.ledH !== null ? String(state.ledH) : '';
  refs.outdoorInput.checked = state.outdoor;

  // Чекбокс «Ещё не знаю дату» — разовое действие «очистить дату», в QuizState не хранится.
  refs.dateInput.value = state.date;
  refs.dateInput.disabled = false;
  refs.dateUnknown.checked = false;
  refs.form.querySelectorAll<HTMLInputElement>('input[name="duration"]').forEach((radio) => {
    radio.checked = radio.value === state.duration;
  });
  refs.venueInput.value = state.venue;
  refs.commentInput.value = state.comment;

  refs.nameInput.value = state.name;
  refs.companyInput.value = state.company;
  refs.clientTypeSelect.value = state.clientType ?? '';
  refs.form.querySelectorAll<HTMLInputElement>('input[name="channel"]').forEach((radio) => {
    radio.checked = radio.value === state.channel;
  });
  refs.contactInput.value = state.contact;
  applyChannelUx(state.channel);
  refs.consentInput.checked = state.consent;

  refs.backBtn.hidden = state.step === 1;
  refs.nextBtn.textContent = state.step === 3 ? 'Получить смету' : 'Далее';

  hideErrors();
}

function showResultView(kind: 'success' | 'error'): void {
  refs.formView.hidden = true;
  refs.successScreen.hidden = kind !== 'success';
  refs.errorScreen.hidden = kind !== 'error';
  // Кнопка сабмита была сфокусирована и только что спряталась вместе с formView — без явного
  // переноса фокус падает на <body>. Успех — на текст (tabindex=-1), ошибка — на повтор.
  if (kind === 'success') {
    refs.successText.focus();
  } else {
    refs.retryBtn.focus();
  }
}

function showFormView(): void {
  refs.successScreen.hidden = true;
  refs.errorScreen.hidden = true;
  refs.formView.hidden = false;
}

function setSubmitDisabled(disabled: boolean): void {
  refs.nextBtn.disabled = disabled;
  refs.retryBtn.disabled = disabled;
}

async function submit(): Promise<void> {
  if (submitting) return;
  const token = ++submitToken;
  submitting = true;
  setSubmitDisabled(true);
  try {
    const payload = toPayload(state, location.pathname, loadUtm(), refs.hpInput.value);
    const res = await fetch('/api/lead.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Зависший на shared-хостинге запрос не должен вечно держать кнопки задизейбленными.
      signal: AbortSignal.timeout(15000),
    });
    const data: unknown = await res.json().catch(() => null);
    const ok =
      res.ok &&
      typeof data === 'object' &&
      data !== null &&
      (data as { ok?: unknown }).ok === true;

    // Заявка принята сервером — цель и очистка стораджа не зависят от того, что сейчас на
    // экране: иначе при закрытом-переоткрытом квизе конверсия не считается, а сохранённый
    // state провоцирует повторную отправку дубля.
    if (ok) {
      reachGoal('lead_quiz');
      removeStore(STATE_KEY);
    }

    // Пока ждали ответ, квиз могли закрыть и открыть заново — чужой ответ DOM не трогает.
    if (token !== submitToken) return;

    // Разблокировать до showResultView: .focus() на задизейбленном retryBtn — no-op.
    submitting = false;
    setSubmitDisabled(false);

    if (ok) {
      refs.successText.textContent = successText(state.channel);
      showResultView('success');
    } else {
      showResultView('error');
    }
  } catch {
    if (token === submitToken) {
      submitting = false;
      setSubmitDisabled(false);
      showResultView('error');
    }
  }
}

function goNext(): void {
  const errors = stepErrors(state);
  if (errors.length > 0) {
    showErrors(errors);
    return;
  }
  if (state.step === 3) {
    void submit();
    return;
  }
  state.step = state.step === 1 ? 2 : 3;
  persist();
  render();
  reachGoal(state.step === 2 ? 'quiz_step2' : 'quiz_step3');
}

function goBack(): void {
  if (state.step === 1) return;
  state.step = state.step === 3 ? 2 : 1;
  persist();
  render();
}

function handleInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const name = target.getAttribute('name');
  if (!name) return;

  switch (name) {
    case 'services': {
      const input = target as HTMLInputElement;
      const key = input.value as ServiceKey;
      state.services = input.checked
        ? [...state.services, key]
        : state.services.filter((s) => s !== key);
      refs.subPlasma.hidden = !state.services.includes('plasma');
      refs.subLed.hidden = !state.services.includes('led');
      break;
    }
    case 'diagonals': {
      const input = target as HTMLInputElement;
      state.diagonals = input.checked
        ? [...state.diagonals, input.value]
        : state.diagonals.filter((d) => d !== input.value);
      break;
    }
    case 'qty': {
      // Пустое/нечисловое поле — 0, а не молчаливая 1: stepErrors увидит qty < 1 и попросит
      // заполнить, вместо того чтобы отправить не то, что на экране.
      const n = (target as HTMLInputElement).valueAsNumber;
      state.qty = Number.isFinite(n) ? n : 0;
      break;
    }
    case 'ledW':
      state.ledW = numOrNull((target as HTMLInputElement).valueAsNumber);
      break;
    case 'ledH':
      state.ledH = numOrNull((target as HTMLInputElement).valueAsNumber);
      break;
    case 'outdoor':
      state.outdoor = (target as HTMLInputElement).checked;
      break;
    case 'date':
      state.date = (target as HTMLInputElement).value;
      break;
    case 'duration':
      state.duration = (target as HTMLInputElement).value;
      break;
    case 'venue': {
      const clean = stripInvisible((target as HTMLInputElement).value);
      if (clean !== (target as HTMLInputElement).value) (target as HTMLInputElement).value = clean;
      state.venue = clean;
      break;
    }
    case 'comment':
      state.comment = (target as HTMLTextAreaElement).value;
      break;
    case 'name': {
      const clean = stripInvisible((target as HTMLInputElement).value);
      if (clean !== (target as HTMLInputElement).value) (target as HTMLInputElement).value = clean;
      state.name = clean;
      break;
    }
    case 'company':
      state.company = (target as HTMLInputElement).value;
      break;
    case 'client_type': {
      const value = (target as HTMLSelectElement).value;
      state.clientType = value === '' ? null : (value as ClientType);
      break;
    }
    case 'channel': {
      const channel = (target as HTMLInputElement).value as Channel;
      state.channel = channel;
      applyChannelUx(channel);
      break;
    }
    case 'contact': {
      const clean = stripInvisible((target as HTMLInputElement).value);
      if (clean !== (target as HTMLInputElement).value) (target as HTMLInputElement).value = clean;
      state.contact = clean;
      break;
    }
    case 'consent':
      state.consent = (target as HTMLInputElement).checked;
      break;
    default:
      return;
  }
  persist();
}

function wireEvents(): void {
  refs.form.addEventListener('input', handleInput);
  // Страховка от неявной отправки (Enter в поле) — она перезагрузила бы страницу.
  refs.form.addEventListener('submit', (event) => event.preventDefault());

  refs.dateUnknown.addEventListener('change', () => {
    if (refs.dateUnknown.checked) {
      state.date = '';
      refs.dateInput.value = '';
      refs.dateInput.disabled = true;
      persist();
    } else {
      refs.dateInput.disabled = false;
    }
  });

  refs.nextBtn.addEventListener('click', goNext);
  refs.backBtn.addEventListener('click', goBack);
  refs.retryBtn.addEventListener('click', () => {
    void submit();
  });
  refs.closeBtn.addEventListener('click', () => refs.dialog.close());

  // Закрытие по затемнению. target === dialog даёт и клик по padding панели, поэтому сверяем
  // координаты с прямоугольником панели; а чтобы драг-выделение текста, отпущенное на фоне,
  // не закрывало квиз, снаружи должны быть и pointerdown, и сам click.
  let pointerDownOutsidePanel = false;
  const isOutsidePanel = (x: number, y: number): boolean => {
    const rect = refs.dialog.getBoundingClientRect();
    return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
  };
  refs.dialog.addEventListener('pointerdown', (event) => {
    pointerDownOutsidePanel = isOutsidePanel(event.clientX, event.clientY);
  });
  refs.dialog.addEventListener('click', (event) => {
    if (pointerDownOutsidePanel && isOutsidePanel(event.clientX, event.clientY)) {
      refs.dialog.close();
    }
  });

  // Esc закрывает dialog нативно; state уже сохранён на каждый input — осталось вернуть фокус.
  refs.dialog.addEventListener('close', () => {
    lastFocused?.focus();
    lastFocused = null;
  });
}

function ensureInit(): void {
  if (initialized) return;
  refs = queryRefs();
  wireEvents();
  initialized = true;
}

/** Открывает квиз: preset с карточки/калькулятора побеждает сохранённое состояние. */
export function openQuiz(presetJson?: string): void {
  ensureInit();

  // Новая сессия: инвалидировать не долетевший fetch прежней и снять её дизейбл с кнопок.
  submitToken += 1;
  submitting = false;
  setSubmitDisabled(false);

  const saved = loadSavedState();
  const preset = parsePreset(presetJson);
  // Пресет меняет оборудование — показываем шаг 1, а не сохранённый шаг: иначе клик по
  // карточке 75″ открывал бы сразу «Куда прислать смету?» с невидимо подменённым составом.
  state = initialState({ ...saved, ...preset, ...(presetJson ? { step: 1 } : {}) });

  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  showFormView();
  render();
  refs.dialog.showModal();
  reachGoal('quiz_open');
}
