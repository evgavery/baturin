// Форматирование чисел для витрины. Держим в одном месте, потому что типографика цен —
// требование ТЗ (§0): разряды и пробел перед знаком рубля неразрывные (U+00A0).
const RUB_FORMAT = new Intl.NumberFormat('ru-RU');

/** Цена как «3 500 ₽»: неразрывные пробелы внутри числа (их ставит Intl) и перед «₽». */
export function rub(value: number): string {
  return `${RUB_FORMAT.format(value)} ₽`;
}
