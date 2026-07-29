// Хелперы, общие для короткой формы, формы подбора и квиза — вынесены сюда, чтобы не плодить
// копии между islands/quiz.ts, islands/short-form.ts и islands/qualify-form.ts (Review Gate
// Task 12: «нет дублирования логики квиза сверх необходимого»). Модуль опирается только на
// quiz-core (сам без зависимостей) — безопасен и как eager-импорт short-form/qualify-form, и как
// транзитивная зависимость ленивого quiz.ts (тот же принцип, что уже держит goals.ts общим между
// eager app.ts и ленивым quiz.ts).
import { validateContact, type Channel, type Utm } from './quiz-core';

/**
 * Zero-width-символы (U+200B–U+200D, U+FEFF) — невидимы и матчятся JS-\s, но НЕ матчатся
 * серверным PCRE и не срезаются PHP trim() (см. isPhone в quiz-core.ts). Чистим на вводе/перед
 * отправкой, а не в quiz-core: там регексы — посимвольное зеркало lead.php, трогать нельзя.
 */
export function stripInvisible(v: string): string {
  return v.replace(/[\u200B-\u200D\uFEFF]/g, '');
}

/** Выбранный канал — из радиогруппы ChannelRadios; один чип всегда отмечен разметкой (первый —
 * по умолчанию), но на случай будущей правки верстки читаем без предположений и допускаем null. */
export function readChannel(form: HTMLFormElement): Channel | null {
  const checked = form.querySelector<HTMLInputElement>('input[name="channel"]:checked');
  return (checked?.value as Channel | undefined) ?? null;
}

/** Проверки, общие для короткой формы и формы подбора (в квизе — свои, пошаговые: см. stepErrors
 * в quiz-core.ts — там ещё услуги/диагонали, здесь их нет). Пустоту имени проверяем по .trim()
 * (как stepErrors в quiz-core.ts), но саму строку не мутируем — вызывающая сторона передаёт и
 * отправляет только stripInvisible-очищенное значение, без .trim(): нативный trim() шире PHP
 * (снимает NBSP/BOM, которые PHP trim() не трогает), поэтому обрезка на клиенте не годится ни
 * для имени, ни для контакта — единообразие важнее лишнего пробела на конце (см. isPhone/phpTrim
 * в quiz-core.ts, там та же асимметрия разобрана для контакта). */
export function contactFormErrors(
  name: string,
  channel: Channel | null,
  contact: string,
  consent: boolean,
): string[] {
  const errors: string[] = [];
  if (name.trim() === '') errors.push('Укажите имя');
  if (channel === null || !validateContact(channel, contact)) {
    errors.push('Проверьте контакт — он не подходит для выбранного канала');
  }
  if (!consent) errors.push('Отметьте согласие на обработку данных');
  return errors;
}

/** utm_v1 пишет app.ts частичным объектом (только реально пришедшие utm_*); хранилище может
 * отсутствовать или быть битым (приватный режим Safari, ручная правка) — тогда меток просто нет. */
export function loadUtm(): Utm | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem('utm_v1');
  } catch {
    return null;
  }
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
