// Чистая логика LED-калькулятора (ТЗ §5.3): без DOM, поэтому одни и те же формулы
// считают вывод в браузере и цены типовых конфигураций при сборке /led-ekrany/.

/** Цена на витрине — ориентир, а не смета: округляем её вверх до 500 ₽. */
const PRICE_STEP = 500;

/** Площадь экрана в м², округлённая до 0,1 — в таком виде её показывает калькулятор. */
export function area(w: number, h: number): number {
  return Math.round(w * h * 10) / 10;
}

/** Цена «от» за сутки. Считается от точной площади: округление площади — только для показа. */
export function priceFrom(w: number, h: number, m2: number): number {
  return Math.ceil((w * h * m2) / PRICE_STEP) * PRICE_STEP;
}

/**
 * Шаг пикселя под дистанцию просмотра: комфортная дистанция в метрах примерно равна
 * шагу в миллиметрах, то есть чем ближе зритель — тем меньше шаг.
 */
export function recommendPitch(distanceM: number): 'P2.5' | 'P3' | 'P4' {
  if (distanceM <= 2.5) return 'P2.5';
  if (distanceM <= 3.5) return 'P3';
  return 'P4';
}
