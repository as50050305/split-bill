import type { Money } from './types';

/** 單筆金額上限（10 億），確保整數運算（金額 × 份數）不會超出安全整數範圍 */
export const MAX_AMOUNT: Money = 1_000_000_000;

export function isValidAmount(n: unknown): n is Money {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= MAX_AMOUNT;
}

export function isNonNegativeMoney(n: unknown): n is Money {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= MAX_AMOUNT;
}

/** 把使用者輸入轉成整數金額。接受「1,234」「 1234 」；小數、負數、空字串回傳 null */
export function parseMoney(input: string): Money | null {
  const s = input.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n <= MAX_AMOUNT ? n : null;
}

/** 1234 → "1,234"；負數 → "-1,234" */
export function formatMoney(n: Money): string {
  const sign = n < 0 ? '-' : '';
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatTWD(n: Money): string {
  return `NT$${formatMoney(n)}`;
}

export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
