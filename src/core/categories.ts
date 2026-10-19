import type { CategoryId } from './types';

export type Tone = 'sage' | 'rose' | 'blue' | 'clay' | 'mustard' | 'lilac' | 'olive';

export interface Category {
  id: CategoryId;
  label: string;
  /** 莫蘭迪色塊顏色（對應 index.css 的 --m-* 變數） */
  tone: Tone;
}

/** v1 固定分類；之後要自訂分類時，把這份改成可存在資料庫的預設值即可 */
export const CATEGORIES: Category[] = [
  { id: 'food', label: '餐飲', tone: 'clay' },
  { id: 'transport', label: '交通', tone: 'blue' },
  { id: 'lodging', label: '住宿', tone: 'lilac' },
  { id: 'ticket', label: '門票', tone: 'mustard' },
  { id: 'shopping', label: '購物', tone: 'rose' },
  { id: 'other', label: '其他', tone: 'olive' },
];

export function categoryOf(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
