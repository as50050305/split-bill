import type { Contribution, Expense, Payment, Rounding, Trip, TripMode } from '../types';

/** 元 → 分 */
export const y = (n: number) => Math.round(n * 100);

let seq = 0;
const nextId = (prefix: string) => `${prefix}${++seq}`;

/**
 * 測試用旅程。rounding 預設 cent（不取整數），讓 edge 測試專注在整數分配邏輯；
 * 需求驗證案例用 App 預設的 yuan。
 */
export function trip(mode: TripMode, names: string[], custodianId?: string, rounding: Rounding = 'cent'): Trip {
  return {
    id: 't1',
    name: 'test',
    mode,
    currency: 'TWD',
    members: names.map((n) => ({ id: n, name: n })),
    custodianId,
    rounding,
    createdAt: 0,
    updatedAt: 0,
  };
}

/** payerId 是測試用的簡寫：單一付款人付全額 */
export function expense({ payerId, ...p }: Pick<Expense, 'amount' | 'split'> & Partial<Expense> & { payerId?: string }): Expense {
  return {
    id: nextId('e'),
    tripId: 't1',
    title: 'x',
    categoryId: 'other',
    date: '2026-10-19',
    createdAt: 0,
    payers: payerId ? { [payerId]: p.amount } : {},
    ...p,
  };
}

export function contribution(memberId: string, amount: number): Contribution {
  return { id: nextId('c'), tripId: 't1', memberId, amount, date: '2026-10-19', createdAt: 0 };
}

export function payment(fromId: string, toId: string, amount: number): Payment {
  return { id: nextId('p'), tripId: 't1', fromId, toId, amount, date: '2026-10-19', createdAt: 0 };
}
