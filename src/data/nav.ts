// Сквозная навигация: шапка, подвал и страница 404 обязаны совпадать по составу и подписям,
// поэтому адреса и подписи разделов живут здесь и нигде больше. Подписи — под SEO-кластеры ТЗ §9.
export interface NavLink {
  href: string;
  label: string;
}

export const HOME_LINK: NavLink = { href: '/', label: 'Главная' };

/** Четыре направления — ядро меню, подвала и страницы 404. */
export const PLASMA_LINK: NavLink = { href: '/plazmy/', label: 'Плазменные панели' };
export const LED_LINK: NavLink = { href: '/led-ekrany/', label: 'LED-экраны' };
export const TOUCH_LINK: NavLink = { href: '/touch-paneli/', label: 'Тач-панели' };
export const STREAM_LINK: NavLink = { href: '/videotranslyacii/', label: 'Видеотрансляции' };

export const DIRECTION_LINKS: NavLink[] = [PLASMA_LINK, LED_LINK, TOUCH_LINK, STREAM_LINK];

/** Страница диагонали — дочерний адрес хаба плазм: `/plazmy/75/`. Адреса нигде не пишутся руками. */
export function diagonalHref(size: string): string {
  return `${PLASMA_LINK.href}${size}/`;
}

export const AGENCY_LINK: NavLink = { href: '/agentstvam/', label: 'Агентствам' };
export const CONTACTS_LINK: NavLink = { href: '/kontakty/', label: 'Контакты' };

/** Разделы «о компании» — вторая половина меню (ТЗ §4). */
export const COMPANY_LINKS: NavLink[] = [AGENCY_LINK, CONTACTS_LINK];

/** Меню шапки — направления плюс разделы для B2B-заказчика. */
export const NAV_LINKS: NavLink[] = [...DIRECTION_LINKS, ...COMPANY_LINKS];

export const POLICY_LINK: NavLink = {
  href: '/politika-konfidencialnosti/',
  label: 'Политика конфиденциальности',
};
