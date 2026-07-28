declare global {
  interface Window {
    ym?: (id: number, action: string, goal: string) => void;
  }
}

/**
 * Отправляет цель в Метрику (если счётчик подключён и загрузился) и ВСЕГДА
 * диспатчит событие `goal` — на нём держатся e2e-проверки целей.
 */
export function reachGoal(goal: string): void {
  const id = Number(document.documentElement.dataset.metrika);
  if (id > 0 && typeof window.ym === 'function') {
    try {
      window.ym(id, 'reachGoal', goal);
    } catch {
      // Аналитика (блокировщик, приватный режим) не должна ломать интерфейс.
    }
  }
  document.dispatchEvent(new CustomEvent('goal', { detail: goal }));
}
