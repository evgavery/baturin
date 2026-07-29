// Квиз «Получить смету» — поведение модалки (Task 11). Вся валидация/сборка payload — через
// quiz-core (Task 10), этот модуль только: рендерит state в DOM, слушает ввод, читает/пишет
// sessionStorage и шлёт запрос. Грузится лениво: app.ts делает dynamic import('./quiz') по
// первому клику на [data-quiz-open], поэтому этот код не должен попасть в eager-бандл.
import { reachGoal } from './goals';
import {
  initialState,
  stepErrors,
  toPayload,
  type Channel,
  type ClientType,
  type QuizState,
  type ServiceKey,
  type Utm,
} from './quiz-core';

const STATE_KEY = 'quiz_state_v1';
const UTM_KEY = 'utm_v1';

const STEP_LABELS: Record<1 | 2 | 3, string> = {
  1: 'ШАГ 1 ИЗ 3 · ОБОРУДОВАНИЕ',
  2: 'ШАГ 2 ИЗ 3 · ДАТЫ И ПЛОЩАДКА',
  3: 'ШАГ 3 ИЗ 3 · КОНТАКТ',
};

/** Плейсхолдер и клавиатура контакта под канал — дословно из брифа Task 11. */
const CHANNEL_UX: Record<Channel, { placeholder: string; inputMode: 'text' | 'tel' | 'email' }> = {
  telegram: { placeholder: '@ник или телефон', inputMode: 'text' },
  whatsapp: { placeholder: '+7 …', inputMode: 'tel' },
  max: { placeholder: '+7 …', inputMode: 'tel' },
  call: { placeholder: '+7 …', inputMode: 'tel' },
  email: { placeholder: 'почта', inputMode: 'email' },
};
const CHANNEL_UX_DEFAULT = { placeholder: 'Телефон, ник или e-mail', inputMode: 'text' as const };

/** Человекочитаемое завершение фразы «Смета придёт …» / отдельная фраза для звонка (ТЗ §6.1). */
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

/** sessionStorage недоступен в приватном режиме Safari — тогда просто работаем без него (как в app.ts). */
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

/**
 * Zero-width-символы (U+200B–U+200D, U+FEFF) — невидимы и матчятся JS-\s, но НЕ матчатся
 * серверным PCRE и не срезаются PHP trim() (см. комментарий isPhone в quiz-core.ts). Чистим на
 * вводе, а не в quiz-core: там регексы — посимвольное зеркало lead.php, трогать нельзя.
 */
function stripInvisible(v: string): string {
  return v.replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function numOrNull(v: number): number | null {
  return Number.isFinite(v) ? v : null;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string');
}

/**
 * Сырые данные из sessionStorage/data-preset могут быть чем угодно — старая версия формата,
 * ручная правка стораджа, опечатка в preset на странице (например `{"services":"plasma"}` —
 * строка вместо массива). initialState() слепо спредит их поверх дефолтов, так что несовпадение
 * ФОРМЫ поля не падает сразу на open, а роняет первое же взаимодействие: например,
 * `state.services.filter(...)` в handleInput бросает, если services — строка, а не массив.
 * Проверяем именно форму (тип) каждого поля по QuizState — не значение; то, что не подходит по
 * типу, просто отбрасываем (остаётся дефолт из initialState), без попытки угадать/починить.
 */
function sanitizePartialState(raw: Record<string, unknown>): Partial<QuizState> {
  const out: Partial<QuizState> = {};
  if (raw.step === 1 || raw.step === 2 || raw.step === 3) out.step = raw.step;
  if (isStringArray(raw.services)) out.services = raw.services as ServiceKey[];
  if (isStringArray(raw.diagonals)) out.diagonals = raw.diagonals;
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
  if (raw.clientType === null || typeof raw.clientType === 'string') {
    out.clientType = raw.clientType as ClientType | null;
  }
  if (raw.channel === null || typeof raw.channel === 'string') out.channel = raw.channel as Channel | null;
  if (typeof raw.contact === 'string') out.contact = raw.contact;
  if (typeof raw.consent === 'boolean') out.consent = raw.consent;
  return out;
}

/** Сохранённое состояние из sessionStorage — как попало (кривой JSON/чужой тип не должны падать). */
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

/** data-preset — JSON-строка с карточки/калькулятора; кривой атрибут не должен ронять страницу. */
function parsePreset(presetJson: string | undefined): Partial<QuizState> {
  if (!presetJson) return {};
  try {
    const parsed: unknown = JSON.parse(presetJson);
    return parsed && typeof parsed === 'object' ? sanitizePartialState(parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** utm_v1 пишет app.ts частичным объектом (только реально пришедшие utm_*); toPayload ждёт Utm|null. */
function loadUtm(): Utm | null {
  const raw = readStore(UTM_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    return {
      source: str(p.source),
      medium: str(p.medium),
      campaign: str(p.campaign),
      content: str(p.content),
      term: str(p.term),
    };
  } catch {
    return null;
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
// Растёт на каждую новую отправку И на каждое openQuiz(): если пользователь успел закрыть квиз,
// открыть заново (новая сессия) и не отправлял ничего ещё раз, ответ СТАРОГО fetch не должен
// подменить экран уже другой, текущей сессии — сверяем токен перед тем, как трогать DOM.
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

// [data-errors] всегда в DOM (без hidden — см. QuizModal.astro): live-регион, появившийся ОДНО-
// ВРЕМЕННО с текстом, скринридеры стабильно не анонсируют — подписка на регион требует, чтобы он
// уже существовал в дереве ДО изменения содержимого. Управляем только textContent; '' = нет
// ошибки, пустая строка визуально схлопывается через [data-errors]:empty в <style>.
function showErrors(errors: string[]): void {
  refs.errorsBox.textContent = errors.join('\n');
}

function hideErrors(): void {
  refs.errorsBox.textContent = '';
}

/** Полный рендер текущего state в DOM: видимость шагов, прогресс, значения всех полей. */
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

  // Шаг 1.
  refs.form.querySelectorAll<HTMLInputElement>('input[name="services"]').forEach((cb) => {
    cb.checked = state.services.includes(cb.value as ServiceKey);
  });
  refs.subPlasma.hidden = !state.services.includes('plasma');
  refs.subLed.hidden = !state.services.includes('led');
  refs.form.querySelectorAll<HTMLInputElement>('input[name="diagonals"]').forEach((cb) => {
    cb.checked = state.diagonals.includes(cb.value);
  });
  refs.qtyInput.value = String(state.qty);
  refs.ledWInput.value = state.ledW !== null ? String(state.ledW) : '';
  refs.ledHInput.value = state.ledH !== null ? String(state.ledH) : '';
  refs.outdoorInput.checked = state.outdoor;

  // Шаг 2. «Ещё не знаю» — переходное UI-состояние без своего поля в QuizState, отражает
  // только пустое значение даты; чекбокс — разовое действие «очистить дату», не хранится.
  refs.dateInput.value = state.date;
  refs.dateInput.disabled = false;
  refs.dateUnknown.checked = false;
  refs.form.querySelectorAll<HTMLInputElement>('input[name="duration"]').forEach((radio) => {
    radio.checked = radio.value === state.duration;
  });
  refs.venueInput.value = state.venue;
  refs.commentInput.value = state.comment;

  // Шаг 3.
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
  // setSubmitDisabled(true) перед отправкой дизейблит сфокусированную кнопку «Далее»/«Получить
  // смету», а formView.hidden прячет её контейнер целиком — без явного переноса фокус проваливается
  // на <body>, и SR-пользователь остаётся «нигде» после сабмита. Успех — на текст (tabindex=-1,
  // просто сообщить результат), ошибка — сразу на «Попробовать ещё раз» (следующее действие рядом).
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
    });
    const data: unknown = await res.json().catch(() => null);
    const ok =
      res.ok &&
      typeof data === 'object' &&
      data !== null &&
      (data as { ok?: unknown }).ok === true;

    // Пока ждали ответ, квиз могли закрыть и открыть заново (новая сессия, token уже другой) —
    // тогда этот ответ больше не про то, что сейчас на экране, трогать DOM нельзя.
    if (token !== submitToken) return;

    // Разблокируем кнопки ДО showResultView, а не в finally ПОСЛЕ него: на error-экране
    // showResultView переводит фокус на retryBtn (MINOR 3), а .focus() на ещё задизейбленной
    // кнопке — no-op в браузере (фокус тогда молча остаётся нигде, ровно тот баг, что чиним).
    submitting = false;
    setSubmitDisabled(false);

    if (ok) {
      reachGoal('lead_quiz');
      removeStore(STATE_KEY);
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

/** Делегированный обработчик всех полей формы (кроме служебного data-date-unknown). */
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
      const n = (target as HTMLInputElement).valueAsNumber;
      state.qty = Number.isFinite(n) ? n : 1;
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
  // Ни одна из кнопок формы не type=submit, но это дешёвая страховка от неявной отправки формы
  // (Enter в поле) — без неё она перезагрузила бы страницу и уничтожила состояние квиза.
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

  // Клик по затемнению закрывает диалог. Проверять event.target === dialog недостаточно: клик по
  // ЛЮБОЙ точке самого dialog (включая его же padding вокруг контента, а не только ::backdrop)
  // тоже даёт target === dialog — тогда клик рядом с заголовком закрывал бы квиз. Сравниваем
  // координаты клика с реальным прямоугольником панели: снаружи нашли — точно затемнение.
  //
  // Одних координат click недостаточно: mousedown внутри поля (выделить текст) → драг мимо
  // панели → mouseup на фоне — это тоже click с координатами снаружи, но пользователь просто
  // тянул выделение, а не просил закрыть квиз. Закрываем только если СНАРУЖИ были и pointerdown,
  // и сам click — то есть весь жест начался и закончился на затемнении.
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

  // Esc закрывает dialog нативно — здесь только пост-обработка: state уже сохранён на каждый
  // input, так что достаточно вернуть фокус на кнопку-открывашку.
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

/** Открывает квиз: preset (клик по карточке/калькулятору) побеждает над сохранённым состоянием. */
export function openQuiz(presetJson?: string): void {
  ensureInit();

  // Новая сессия квиза: любой не долетевший ответ от ПРЕЖНЕЙ отправки (закрыли посреди fetch)
  // не должен позже подменить этот экран — и кнопки не должны остаться заблокированы её тенью.
  submitToken += 1;
  submitting = false;
  setSubmitDisabled(false);

  const saved = loadSavedState();
  const preset = parsePreset(presetJson);
  state = initialState({ ...saved, ...preset });

  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  showFormView();
  render();
  refs.dialog.showModal();
  reachGoal('quiz_open');
}
