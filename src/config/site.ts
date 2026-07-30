// Единственное место с данными клиента и ценами (ТЗ §0, §15): заменяются за один заход.
// Незаполненные значения помечены TODO и намеренно выглядят как заглушки — выдумывать реальные
// телефоны, ИНН, названия компаний и цены запрещено.
// В русских текстах проекта используются неразрывные пробелы (U+00A0) в числах и перед «₽».

export interface DayPrices {
  d1: number;
  d2: number;
  d3: number;
}

// TODO: реальные цены клиента — ниже рыночные ориентиры для вёрстки из ТЗ §8.1.
// Из первых строк таблиц считаются цены «от» на витрине (prices.touch / prices.stream) —
// таблицы держат позиции отсортированными от дешёвой к дорогой.
const TOUCH_TABLE = [
  { label: 'Тач-панель 55″ на стойке', d1: 8000 },
  { label: 'Тач-панель 65″ на стойке', d1: 12000 },
  { label: 'Интерактивный киоск', d1: 15000 },
];
const STREAM_TABLE = [
  { label: 'Конференция, 1 камера', d1: 45000 },
  { label: 'Конференция, 2–3 камеры + режиссёр', d1: 90000 },
  { label: 'Гибрид: зал + онлайн', d1: 120000 },
];

export const SITE: {
  url: string;
  brandName: string;
  slogan: string;
  phone: string;
  phoneHref: string;
  email: string;
  tgLink: string;
  waLink: string;
  maxLink: string;
  metrikaId: number;
  requisites: string;
  workArea: string;
  flagship: { name: string; specs: [string, string, string] };
  agencyTerms: string;
  park: { ledTotalM2: number; plasmaUnits: number };
  clientLogos: { name: string; svg: string }[];
  prices: {
    plasma: Record<'55' | '75' | '86' | '98', DayPrices>;
    ledM2: number;
    touch: number;
    stream: number;
    touchTable: { label: string; d1: number }[];
    streamTable: { label: string; d1: number }[];
  };
  included: string[];
} = {
  url: 'https://screenrent-placeholder.ru', // TODO: реальные данные клиента — домен (ТЗ §8.2 п.1)
  brandName: 'Screenrent', // TODO: реальные данные клиента — название и логотип (ТЗ §8.2 п.1)
  slogan: 'Экраны для тех, кто делает ивенты', // TODO: слоган не утверждён (ТЗ §2, §8.2 п.8)
  phone: '+7 (495) 000-00-00', // TODO: реальные данные клиента (ТЗ §8.2 п.5)
  phoneHref: 'tel:+74950000000', // TODO: реальные данные клиента
  email: 'zayavki@example.com', // TODO: реальные данные клиента
  tgLink: 'https://t.me/username_placeholder', // TODO: реальные данные клиента
  waLink: 'https://wa.me/70000000000', // TODO: реальные данные клиента
  maxLink: 'https://max.ru/u/username_placeholder', // TODO: реальные данные клиента
  metrikaId: 0, // TODO: реальные данные клиента — номер счётчика Метрики (ТЗ §8.2 п.7); 0 = счётчик не подключается
  requisites: 'ИП Фамилия И.О., ИНН 000000000000', // TODO: реальные данные клиента (ТЗ §8.2 п.4)
  workArea: 'Работаем в Москве и МО, выезжаем по России',
  flagship: {
    // TODO: реальные данные клиента — модель и характеристики флагманского экрана (ТЗ §8.2 п.6, п.11)
    name: 'Флагманский LED-экран — модель уточняется',
    specs: ['Площадь до NN м²', 'Шаг пикселя P2.6', 'Яркость для света и улицы'],
  },
  // TODO: реальные данные клиента — агентские условия и программа скидок (ТЗ §8.2 п.11)
  agencyTerms:
    'Условия для агентств и организаторов — индивидуальные: зависят от регулярности заказов и объёма проекта.',
  // TODO: реальные данные клиента — подтвердить цифры парка и формулировку («видов» или «штук»), ТЗ §8.2 п.9
  park: { ledTotalM2: 250, plasmaUnits: 120 },
  clientLogos: [], // TODO: реальные данные клиента — логотипы клиентов и разрешение на публикацию (ТЗ §8.2 п.10)
  prices: {
    // TODO: реальные цены клиента — рыночные ориентиры для вёрстки из ТЗ §8.1
    plasma: {
      '55': { d1: 3500, d2: 5500, d3: 7500 },
      '75': { d1: 9000, d2: 15000, d3: 21000 },
      '86': { d1: 19000, d2: 28000, d3: 37000 },
      '98': { d1: 40000, d2: 60000, d3: 80000 },
    },
    ledM2: 3500,
    touch: TOUCH_TABLE[0].d1,
    stream: STREAM_TABLE[0].d1,
    touchTable: TOUCH_TABLE,
    streamTable: STREAM_TABLE,
  },
  // TODO: реальные данные клиента — подтвердить состав «что включено» (ТЗ §8.1)
  included: [
    'Доставка в пределах МКАД',
    'Монтаж и демонтаж',
    'Напольная стойка или настенный кронштейн',
    'Кабели и коммутация',
    'Инструктаж вашей команды на площадке',
  ],
};
