import { SITE } from '../config/site';

/** Тройка мессенджеров с целями Метрики — подвал, контакты, экраны квиза и ошибок форм. */
export const MESSENGER_LINKS = [
  { href: SITE.tgLink, goal: 'click_tg', label: 'Telegram' },
  { href: SITE.waLink, goal: 'click_wa', label: 'WhatsApp' },
  { href: SITE.maxLink, goal: 'click_max', label: 'MAX' },
] as const;
