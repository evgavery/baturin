import type { ClientType } from '../islands/quiz-core';

/** Четыре типа клиента — одинаковые значения и подписи в квизе и форме подбора. */
export const CLIENT_TYPE_OPTIONS: { value: ClientType; label: string }[] = [
  { value: 'agency', label: 'Ивент-агентство' },
  { value: 'organizer', label: 'Организатор мероприятий' },
  { value: 'company', label: 'Компания (прямой заказчик)' },
  { value: 'other', label: 'Другое' },
];
