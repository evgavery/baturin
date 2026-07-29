import { describe, expect, it } from 'vitest';
import { area, priceFrom, recommendPitch } from './calc-core';

// Формулы LED-калькулятора (ТЗ §5.3) фиксируются тестом: одним и тем же кодом считаются
// вывод калькулятора в браузере и цены типовых конфигураций при сборке /led-ekrany/.
// Ставка за м² в тестах задана числом намеренно — она приходит параметром, а не из SITE.
const M2 = 3500;

describe('LED-калькулятор: площадь', () => {
  it('площадь — произведение сторон в м²', () => {
    expect(area(4, 2.5)).toBe(10);
    expect(area(3, 2.5)).toBe(7.5);
  });

  it('площадь округляется до 0,1 м²', () => {
    expect(area(3.3, 2.1)).toBe(6.9);
  });
});

describe('LED-калькулятор: цена «от»', () => {
  it('цена — площадь × ставка за м² с округлением вверх до 500 ₽', () => {
    expect(priceFrom(4, 2.5, M2)).toBe(35000);
    expect(priceFrom(3, 2.5, M2)).toBe(26500);
    expect(priceFrom(3.3, 2.1, M2)).toBe(24500);
  });

  it('цена считается от неокруглённой площади', () => {
    // 2,6 × 2,2 = 5,72 м² → 20 500 ₽. От показанных на экране 5,7 м² вышло бы 20 000 ₽:
    // округление площади — только для показа, в деньгах оно не участвует.
    expect(priceFrom(2.6, 2.2, M2)).toBe(20500);
  });
});

describe('LED-калькулятор: шаг пикселя', () => {
  it('P2.5 — зритель в пределах 2,5 м', () => {
    expect(recommendPitch(2)).toBe('P2.5');
    expect(recommendPitch(2.5)).toBe('P2.5');
  });

  it('P3 — зритель от 2,5 до 3,5 м', () => {
    expect(recommendPitch(2.6)).toBe('P3');
    expect(recommendPitch(3.5)).toBe('P3');
  });

  it('P4 — зритель дальше 3,5 м', () => {
    expect(recommendPitch(3.6)).toBe('P4');
    expect(recommendPitch(10)).toBe('P4');
  });
});
