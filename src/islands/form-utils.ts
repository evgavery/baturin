// Хелперы, общие для короткой формы, формы подбора и квиза. Зависят только от quiz-core —
// безопасны и в eager-бандле форм, и как транзитивная зависимость ленивого quiz.ts.
import { validateContact, type Channel, type Utm } from './quiz-core';

/**
 * Zero-width-символы (U+200B–U+200D, U+FEFF) невидимы, но не матчятся серверным PCRE и не
 * срезаются PHP trim(). Чистим на вводе, а не в quiz-core: там регексы — зеркало lead.php.
 */
export function stripInvisible(v: string): string {
  return v.replace(/[\u200B-\u200D\uFEFF]/g, '');
}

export function readChannel(form: HTMLFormElement): Channel | null {
  const checked = form.querySelector<HTMLInputElement>('input[name="channel"]:checked');
  return (checked?.value as Channel | undefined) ?? null;
}

/**
 * Проверки короткой формы и формы подбора (в квизе — свои пошаговые stepErrors). Строки не
 * тримятся намеренно: нативный trim() шире PHP-шного (см. phpTrim в quiz-core.ts), рассинхрон
 * с сервером опаснее краевого пробела.
 */
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

/** utm_v1 пишет app.ts частичным объектом; битое/недоступное хранилище — просто нет меток. */
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
