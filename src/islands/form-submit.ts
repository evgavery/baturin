// Общая отправка короткой формы и формы подбора (Task 12): единственное место с fetch, дизейблом
// кнопки на время запроса и показом результата — короткая форма и форма подбора не заводят по
// своей копии этой логики (Review Gate). Контракт разметки Task 4 (см. комментарии в
// CtaBlock.astro и QualifyForm.astro): [data-errors] — aria-live-регион ВНУТРИ формы, всегда в
// DOM, меняем только textContent, [data-error-links] — соседние прямые ссылки на мессенджеры,
// скрыты/показаны через hidden (не live-регион — hidden для него безопасен); [data-success] —
// сосед формы в той же карточке, изначально hidden.
import { reachGoal } from './goals';

function req<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`form-submit: не найден элемент "${selector}"`);
  return el;
}

/** Общий сброс перед новой попыткой — и для показа ошибок валидации, и перед сабмитом. */
function clearErrors(form: HTMLFormElement): void {
  req<HTMLElement>(form, '[data-errors]').textContent = '';
  const links = form.querySelector<HTMLElement>('[data-error-links]');
  if (links) links.hidden = true;
}

/**
 * Показывает ошибки валидации в живом регионе формы (ссылки на мессенджеры тут не нужны — это
 * подсказка исправить поле, а не «не достучались»).
 */
export function showErrors(form: HTMLFormElement, messages: string[]): void {
  clearErrors(form);
  req<HTMLElement>(form, '[data-errors]').textContent = messages.join('\n');
}

/**
 * Отправляет заявку: дизейблит кнопку submit на время запроса, POST на /api/lead.php (JSON).
 * Успех (`ok:true`) — цель в Метрику, форма прячется и показывается [data-success] с переносом
 * фокуса (переход hidden→visible без явного фокуса не анонсируется скринридером). Ошибка (сеть
 * или ответ не ok:true) — текст в [data-errors] и прямые ссылки на мессенджеры; форма и введённое
 * остаются как есть. Кнопка снова активна после ЛЮБОГО ответа — до переключения экрана (иначе на
 * ещё задизейбленной кнопке `.focus()` был бы no-op).
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
    // Дизейбл кнопки на время запроса (выше) снял с неё фокус — браузер уронил его на <body>.
    // aria-live озвучивает текст ошибки сам по себе, но фокус клавиатурного/скринридер-пользователя
    // остаётся «нигде»: возвращаем его на кнопку — она же следующее действие (повторный сабмит).
    submitBtn.focus();
  }

  return ok;
}
