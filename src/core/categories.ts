import type { CategoryId } from './types';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string;
}

/** v1 固定分類；之後要自訂分類時，把這份改成可存在資料庫的預設值即可 */
export const CATEGORIES: Category[] = [
  { id: 'food', label: '餐飲', icon: '🍜' },
  { id: 'transport', label: '交通', icon: '🚃' },
  { id: 'lodging', label: '住宿', icon: '🏨' },
  { id: 'ticket', label: '門票', icon: '🎫' },
  { id: 'shopping', label: '購物', icon: '🛍️' },
  { id: 'other', label: '其他', icon: '📦' },
];

export function categoryOf(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
