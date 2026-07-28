// Сквозная навигация: шапка, подвал и страница 404 обязаны совпадать по составу и подписям,
// поэтому адреса и подписи разделов живут здесь и нигде больше. Подписи — под SEO-кластеры ТЗ §9.
export interface NavLink {
  href: string;
  label: string;
}

export const HOME_LINK: NavLink = { href: '/', label: 'Главная' };

/** Четыре направления — ядро меню, подвала и страницы 404. */
export const DIRECTION_LINKS: NavLink[] = [
  { href: '/plazmy/', label: 'Плазменные панели' },
  { href: '/led-ekrany/', label: 'LED-экраны' },
  { href: '/touch-paneli/', label: 'Тач-панели' },
  { href: '/videotranslyacii/', label: 'Видеотрансляции' },
];

export const CONTACTS_LINK: NavLink = { href: '/kontakty/', label: 'Контакты' };

/** Разделы «о компании» — вторая половина меню (ТЗ §4). */
export const COMPANY_LINKS: NavLink[] = [
  { href: '/agentstvam/', label: 'Агентствам' },
  CONTACTS_LINK,
];

/** Меню шапки — направления плюс разделы для B2B-заказчика. */
export const NAV_LINKS: NavLink[] = [...DIRECTION_LINKS, ...COMPANY_LINKS];

export const POLICY_LINK: NavLink = {
  href: '/politika-konfidencialnosti/',
  label: 'Политика конфиденциальности',
};
