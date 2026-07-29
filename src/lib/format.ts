// Форматирование чисел для витрины. Держим в одном месте, потому что типографика цен —
// требование ТЗ (§0): разряды и пробел перед знаком рубля неразрывные (U+00A0).
const NUMBER_FORMAT = new Intl.NumberFormat('ru-RU');

/** Число как «7,5» или «1 200»: запятая в дробной части, неразрывные разряды (их ставит Intl). */
export function num(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/** Цена как «3 500 ₽»: неразрывные пробелы внутри числа (их ставит Intl) и перед «₽». */
export function rub(value: number): string {
  return `${NUMBER_FORMAT.format(value)} ₽`;
}
