import type { Contribution, Expense, Payment, Trip, TripMode } from '../types';

let seq = 0;
const nextId = (prefix: string) => `${prefix}${++seq}`;

export function trip(mode: TripMode, names: string[], custodianId?: string): Trip {
  return {
    id: 't1',
    name: 'test',
    mode,
    currency: 'TWD',
    members: names.map((n) => ({ id: n, name: n })),
    custodianId,
    createdAt: 0,
    updatedAt: 0,
  };
}

export function expense(p: Pick<Expense, 'amount' | 'split'> & Partial<Expense>): Expense {
  return {
    id: nextId('e'),
    tripId: 't1',
    title: 'x',
    categoryId: 'other',
    date: '2026-10-19',
    createdAt: 0,
    ...p,
  };
}

export function contribution(memberId: string, amount: number): Contribution {
  return { id: nextId('c'), tripId: 't1', memberId, amount, date: '2026-10-19', createdAt: 0 };
}

export function payment(fromId: string, toId: string, amount: number): Payment {
  return { id: nextId('p'), tripId: 't1', fromId, toId, amount, date: '2026-10-19', createdAt: 0 };
}
