import type { Money } from './types';

/**
 * 金額一律以「分」（1/100 元）的整數儲存與計算。
 * 例：NT$ 333.33 → 33333。這樣可以算到小數 2 位，又完全不用浮點數。
 */
export const CENTS = 100;

/** 單筆金額上限 1 億元（= 1e10 分），確保「金額 × 份數」仍在安全整數範圍內 */
export const MAX_AMOUNT: Money = 100_000_000 * CENTS;

export function isValidAmount(n: unknown): n is Money {
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= MAX_AMOUNT;
}

export function isNonNegativeMoney(n: unknown): n is Money {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= MAX_AMOUNT;
}

/** 元 → 分 */
export const yuan = (n: number): Money => Math.round(n * CENTS);

/**
 * 使用者輸入 → 分。接受「1,234」「1234.5」「1234.56」；
 * 超過 2 位小數、負數、空字串回傳 null。不經過浮點數。
 */
export function parseMoney(input: string): Money | null {
  const s = input.replace(/[,\s]/g, '');
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]) * CENTS + Number((m[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(n) && n <= MAX_AMOUNT ? n : null;
}

export type DecimalMode = 'auto' | 'always' | 'never';

/**
 * 分 → 顯示字串，加千分位。
 * auto：整數元就不顯示小數（1,000），有零頭才顯示（333.33）
 * always：一律 2 位小數；never：四捨五入到元
 */
export function formatMoney(cents: Money, mode: DecimalMode = 'auto'): string {
  if (mode === 'never') cents = roundToYuan(cents);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const int = Math.floor(abs / CENTS)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = abs % CENTS;
  const showFrac = mode === 'always' || (mode === 'auto' && frac !== 0);
  return sign + int + (showFrac ? '.' + String(frac).padStart(2, '0') : '');
}

export function formatTWD(cents: Money, mode: DecimalMode = 'auto'): string {
  return `NT$${formatMoney(cents, mode)}`;
}

/** 四捨五入到整數元（仍以分表示，例 33333 → 33300、33350 → 33400、-33350 → -33400） */
export function roundToYuan(cents: Money): Money {
  const sign = cents < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(cents) / CENTS) * CENTS;
}

/** 輸入框用：分 → 可編輯的字串（不含千分位） */
export function toInputString(cents: Money): string {
  return formatMoney(cents, 'auto').replace(/,/g, '');
}

export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
