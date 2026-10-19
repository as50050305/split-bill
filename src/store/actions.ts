/**
 * 所有資料變更都是純函式：(舊資料, 參數) → 新資料。方便測試，也方便之後接同步。
 */
import type { Contribution, Expense, Group, ID, Member, Payment, Trip } from '../core/types';
import type { AppData } from '../data/repository';

// ── 常用成員 ─────────────────────────────
export const addMember = (d: AppData, m: Member): AppData => ({ ...d, members: [...d.members, m] });

export const renameMember = (d: AppData, id: ID, name: string): AppData => ({
  ...d,
  members: d.members.map((m) => (m.id === id ? { ...m, name } : m)),
});

/** 刪除常用成員：同時從群組移除；旅程裡的成員是快照，不受影響 */
export const deleteMember = (d: AppData, id: ID): AppData => ({
  ...d,
  members: d.members.filter((m) => m.id !== id),
  groups: d.groups.map((g) => ({ ...g, memberIds: g.memberIds.filter((x) => x !== id) })),
});

// ── 常用群組 ─────────────────────────────
export const upsertGroup = (d: AppData, g: Group): AppData => ({
  ...d,
  groups: d.groups.some((x) => x.id === g.id) ? d.groups.map((x) => (x.id === g.id ? g : x)) : [...d.groups, g],
});

export const deleteGroup = (d: AppData, id: ID): AppData => ({ ...d, groups: d.groups.filter((g) => g.id !== id) });

// ── 旅程 ─────────────────────────────────
export const upsertTrip = (d: AppData, t: Trip): AppData => ({
  ...d,
  trips: d.trips.some((x) => x.id === t.id) ? d.trips.map((x) => (x.id === t.id ? t : x)) : [t, ...d.trips],
});

/** 刪除旅程連同其所有紀錄 */
export const deleteTrip = (d: AppData, id: ID): AppData => ({
  ...d,
  trips: d.trips.filter((t) => t.id !== id),
  expenses: d.expenses.filter((e) => e.tripId !== id),
  contributions: d.contributions.filter((c) => c.tripId !== id),
  payments: d.payments.filter((p) => p.tripId !== id),
});

const touch = (d: AppData, tripId: ID): AppData => ({
  ...d,
  trips: d.trips.map((t) => (t.id === tripId ? { ...t, updatedAt: Date.now() } : t)),
});

// ── 支出 ─────────────────────────────────
export const upsertExpense = (d: AppData, e: Expense): AppData =>
  touch(
    {
      ...d,
      expenses: d.expenses.some((x) => x.id === e.id)
        ? d.expenses.map((x) => (x.id === e.id ? e : x))
        : [...d.expenses, e],
    },
    e.tripId,
  );

export const deleteExpense = (d: AppData, id: ID): AppData => ({
  ...d,
  expenses: d.expenses.filter((e) => e.id !== id),
});

// ── 公費投入 ─────────────────────────────
export const addContributions = (d: AppData, cs: Contribution[]): AppData =>
  cs.length ? touch({ ...d, contributions: [...d.contributions, ...cs] }, cs[0].tripId) : d;

export const deleteContribution = (d: AppData, id: ID): AppData => ({
  ...d,
  contributions: d.contributions.filter((c) => c.id !== id),
});

// ── 已還款 ───────────────────────────────
export const addPayment = (d: AppData, p: Payment): AppData => ({ ...d, payments: [...d.payments, p] });

export const deletePayment = (d: AppData, id: ID): AppData => ({
  ...d,
  payments: d.payments.filter((p) => p.id !== id),
});

// ── 查詢 ─────────────────────────────────
export function tripLedger(d: AppData, tripId: ID) {
  return {
    expenses: d.expenses.filter((e) => e.tripId === tripId),
    contributions: d.contributions.filter((c) => c.tripId === tripId),
    payments: d.payments.filter((p) => p.tripId === tripId),
  };
}

/** 旅程成員是否已經被任何紀錄用到（用到就不能從旅程移除） */
export function isTripMemberUsed(d: AppData, tripId: ID, memberId: ID): boolean {
  const { expenses, contributions, payments } = tripLedger(d, tripId);
  return (
    expenses.some((e) => {
      if (e.payerId === memberId) return true;
      const s = e.split;
      if (s.type === 'equal') return s.participants.includes(memberId);
      if (s.type === 'shares') return (s.shares[memberId] ?? 0) > 0;
      return (s.amounts[memberId] ?? 0) > 0;
    }) ||
    contributions.some((c) => c.memberId === memberId) ||
    payments.some((p) => p.fromId === memberId || p.toId === memberId)
  );
}

export function tripHasRecords(d: AppData, tripId: ID): boolean {
  const l = tripLedger(d, tripId);
  return l.expenses.length + l.contributions.length + l.payments.length > 0;
}
