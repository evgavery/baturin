import { describe, it, expect } from 'vitest';
import { SITE } from '../config/site';
import { DIAGONALS } from './diagonals';

describe('данные', () => {
  it('4 диагонали с габаритами из ТЗ', () => {
    expect(DIAGONALS.map(d => [d.size, d.widthCm, d.heightCm])).toEqual([
      ['55', 125, 73], ['75', 168, 97], ['86', 195, 115], ['98', 223, 128],
    ]);
  });
  it('цены диагоналей берутся из SITE (один источник)', () => {
    for (const d of DIAGONALS) expect(d.prices).toBe(SITE.prices.plasma[d.size]);
  });
  // Пины значений-заглушек — намеренный трипвайр: когда придут реальные данные клиента,
  // эти тесты обязаны упасть и напомнить пройти чек-лист запуска (README).
  it('рыночные ориентиры ТЗ §8.1', () => {
    expect(SITE.prices.plasma['55']).toEqual({ d1: 3500, d2: 5500, d3: 7500 });
    expect(SITE.prices.plasma['98'].d1).toBe(40000);
    expect(SITE.prices.ledM2).toBe(3500);
  });
  it('цены «от» совпадают с минимумом своих таблиц', () => {
    expect(SITE.prices.touch).toBe(Math.min(...SITE.prices.touchTable.map((r) => r.d1)));
    expect(SITE.prices.stream).toBe(Math.min(...SITE.prices.streamTable.map((r) => r.d1)));
  });
  it('у каждой диагонали 3+ сценария и 3 FAQ', () => {
    for (const d of DIAGONALS) { expect(d.scenarios.length).toBeGreaterThanOrEqual(3); expect(d.faq.length).toBe(3); }
  });
  it('цифры парка для слайдера (ТЗ §5.1 п.1) и пустые логотипы', () => {
    expect(SITE.park.ledTotalM2).toBe(250);
    expect(SITE.park.plasmaUnits).toBe(120);
    expect(SITE.clientLogos).toEqual([]);
  });
});
