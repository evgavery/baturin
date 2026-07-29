// Мини-калькулятор LED (ТЗ §5.3). Считает calc-core, здесь — только чтение полей и вывод.
// Правило острова: что бы ни оказалось в поле (пусто, буквы, 999), пользователь видит число,
// а не NaN, — значение приводится к границам min/max самого поля.
import { SITE } from '../config/site';
import { num, rub } from '../lib/format';
import { area, priceFrom, recommendPitch } from './calc-core';
import { reachGoal } from './goals';

/** Цель calc_use — одна на сессию, поэтому флаг переживает переходы по сайту. */
const SESSION_KEY = 'calc_used';

/** Значение поля в его же границах: пустое или нечисловое — это минимум поля. */
function readField(input: HTMLInputElement): number {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = input.valueAsNumber;
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function initCalc(root: HTMLElement): void {
  const width = root.querySelector<HTMLInputElement>('input[name="w"]');
  const height = root.querySelector<HTMLInputElement>('input[name="h"]');
  const distance = root.querySelector<HTMLInputElement>('input[name="dist"]');
  const outArea = root.querySelector<HTMLElement>('[data-out="area"]');
  const outPitch = root.querySelector<HTMLElement>('[data-out="pitch"]');
  const outPrice = root.querySelector<HTMLElement>('[data-out="price"]');
  const quizButton = root.querySelector<HTMLElement>('[data-quiz-open]');
  if (!width || !height || !distance || !outArea || !outPitch || !outPrice) return;

  let goalSent = false;

  const sendUseGoal = (): void => {
    if (goalSent) return;
    goalSent = true;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // Приватный режим Safari: хранилища нет — тогда цель уходит раз на загрузку страницы.
    }
    reachGoal('calc_use');
  };

  const render = (): void => {
    const w = readField(width);
    const h = readField(height);

    outArea.textContent = `${num(area(w, h))}\u00A0м²`;
    outPitch.textContent = recommendPitch(readField(distance));
    outPrice.textContent = `от ${rub(priceFrom(w, h, SITE.prices.ledM2))}`;
    quizButton?.setAttribute(
      'data-preset',
      JSON.stringify({ services: ['led'], ledW: w, ledH: h }),
    );
  };

  // Один делегированный обработчик на весь блок: события input всплывают от любого поля.
  root.addEventListener('input', () => {
    render();
    sendUseGoal();
  });

  // Стартовый пересчёт: после перезагрузки браузер возвращает в поля прежние значения,
  // и серверная разметка вывода перестала бы им соответствовать.
  render();
}

const calc = document.getElementById('led-calc');
if (calc) initCalc(calc);
