// Единственный eager-скрипт на всех страницах: UTM, цели, бургер, cookie-строка.
// Держать маленьким — грузится до всего остального.
import { reachGoal } from './goals';

const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;

/** Хранилища недоступны в приватном режиме Safari — тогда просто работаем без них. */
function readStore(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(store: Storage, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    // ignore
  }
}

/** Метки источника переживают переходы по сайту и уезжают вместе с заявкой. */
function saveUtm(): void {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`);
    if (value) utm[key] = value;
  }
  if (Object.keys(utm).length > 0) {
    writeStore(sessionStorage, 'utm_v1', JSON.stringify(utm));
  }
}

function initGoals(): void {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const goal = target.closest('[data-goal]')?.getAttribute('data-goal');
    if (goal) reachGoal(goal);
  });
}

function initNav(): void {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const open = nav.toggleAttribute('data-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    // nav стоит в DOM раньше toggle (нужно для порядка на десктопе, где меню — строка между
    // лого и телефоном). На мобильном это значит: после открытия свежепоявившиеся пункты меню
    // стоят в tab-порядке РАНЬШЕ toggle, и Tab вперёд от toggle уводит мимо меню в контент.
    // Переносим фокус на первый пункт явно — как уже делает нативный <dialog> у квиза.
    if (open) {
      nav.querySelector<HTMLElement>('a, button')?.focus();
    }
  });
}

/** Открытие квиза лениво: quiz.ts (самый тяжёлый остров сайта) не должен попасть в eager-бандл. */
function initQuizLauncher(): void {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest('[data-quiz-open]');
    if (!trigger) return;
    event.preventDefault();
    const preset = trigger.getAttribute('data-preset') ?? undefined;
    void import('./quiz')
      .then((m) => m.openQuiz(preset))
      .catch(() => {
        // Сеть отвалилась ровно на этом чанке — квиз открыть нечем, но молчать нельзя (финальное
        // ревью, MINOR 9). MessengerDock — eager и уже на странице: ведём туда явно.
        const dock = document.getElementById('messenger-dock');
        dock?.scrollIntoView({ block: 'center' });
        dock?.querySelector<HTMLElement>('a')?.focus();
      });
  });
}

function initCookieBar(): void {
  const bar = document.getElementById('cookie-bar');
  const accept = document.getElementById('cookie-ok');
  if (!bar || !accept) return;
  if (readStore(localStorage, 'cookie_ok')) return;

  bar.hidden = false;
  accept.addEventListener('click', () => {
    writeStore(localStorage, 'cookie_ok', '1');
    bar.hidden = true;
  });
}

saveUtm();
initGoals();
initNav();
initQuizLauncher();
initCookieBar();
