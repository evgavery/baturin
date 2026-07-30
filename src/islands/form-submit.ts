// Общая отправка короткой формы и формы подбора. Контракт разметки: [data-errors] —
// aria-live-регион внутри формы, всегда в DOM, меняем только textContent; [data-error-links] —
// прямые ссылки на мессенджеры, переключаются через hidden; [data-success] — сосед формы
// в той же карточке, изначально hidden.
import { reachGoal } from './goals';

function req<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`form-submit: не найден элемент "${selector}"`);
  return el;
}

function clearErrors(form: HTMLFormElement): void {
  req<HTMLElement>(form, '[data-errors]').textContent = '';
  const links = form.querySelector<HTMLElement>('[data-error-links]');
  if (links) links.hidden = true;
}

export function showErrors(form: HTMLFormElement, messages: string[]): void {
  clearErrors(form);
  req<HTMLElement>(form, '[data-errors]').textContent = messages.join('\n');
}

/**
 * Отправляет заявку. Кнопка разблокируется до переключения экрана: .focus() на задизейбленной
 * кнопке — no-op, и фокус повис бы на <body>.
 */
export async function submitLead(
  form: HTMLFormElement,
  payload: object,
  goal: string,
): Promise<boolean> {
  const submitBtn = req<HTMLButtonElement>(form, 'button[type="submit"]');
  clearErrors(form);
  submitBtn.disabled = true;

  let ok = false;
  try {
    const res = await fetch('/api/lead.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Зависший запрос не должен вечно держать submit задизейбленным.
      signal: AbortSignal.timeout(15000),
    });
    const data: unknown = await res.json().catch(() => null);
    ok =
      res.ok && typeof data === 'object' && data !== null && (data as { ok?: unknown }).ok === true;
  } catch {
    ok = false;
  }

  submitBtn.disabled = false;

  if (ok) {
    reachGoal(goal);
    form.hidden = true;
    const successBox = req<HTMLElement>(form.parentElement ?? document.body, '[data-success]');
    successBox.hidden = false;
    successBox.focus();
  } else {
    req<HTMLElement>(form, '[data-errors]').textContent =
      'Не получилось отправить. Попробуйте ещё раз или напишите нам напрямую:';
    const links = form.querySelector<HTMLElement>('[data-error-links]');
    if (links) links.hidden = false;
    // Дизейбл на время запроса уронил фокус на <body> — возвращаем на кнопку повторного сабмита.
    submitBtn.focus();
  }

  return ok;
}
