import { isNonNegativeMoney, isValidAmount, sum } from './money';
import type { ID, Money, SplitSpec } from './types';

/**
 * 份數最多支援小數點後 2 位（例如 0.5、1.25），內部放大 100 倍成整數計算，
 * 全程不用浮點數做金額運算。
 */
export const SHARE_SCALE = 100;

export type SplitValidation =
  | { ok: true }
  | { ok: false; reason: 'invalidAmount' | 'noParticipants' | 'invalidShare' | 'invalidExactAmount' | 'unknownMember' }
  | { ok: false; reason: 'exactMismatch'; diff: Money };

export class SplitError extends Error {
  readonly validation: SplitValidation;
  constructor(validation: SplitValidation) {
    super(`Invalid split: ${validation.ok ? 'ok' : validation.reason}`);
    this.validation = validation;
  }
}

/**
 * 平均分攤。除不盡時，多出來的 1 元依序分給名單前面的人。
 * 100 / [A,B,C] → A 34, B 33, C 33
 */
export function splitEqual(amount: Money, participants: ID[]): Record<ID, Money> {
  const n = participants.length;
  const base = Math.floor(amount / n);
  let remainder = amount - base * n;
  const result: Record<ID, Money> = {};
  for (const id of participants) {
    result[id] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  }
  return result;
}

export function shareToUnits(share: number): number {
  return Math.round(share * SHARE_SCALE);
}

/**
 * 依份數分攤，零頭用「最大餘數法」：
 * 每人先拿整數部分，剩下的元依「小數部分（餘數）由大到小」各補 1 元，餘數相同時依名單順序。
 * 100 元按 0.5 / 1 / 2 份 → 14 / 29 / 57
 */
export function splitShares(amount: Money, entries: { id: ID; share: number }[]): Record<ID, Money> {
  const units = entries.map((e) => ({ id: e.id, units: shareToUnits(e.share) }));
  const totalUnits = sum(units.map((u) => u.units));
  const rows = units.map((u, order) => {
    const numerator = amount * u.units; // amount ≤ 1e9、units ≤ 1e5 → 安全整數範圍內
    return {
      id: u.id,
      order,
      base: Math.floor(numerator / totalUnits),
      remainder: numerator % totalUnits,
    };
  });
  let leftover = amount - sum(rows.map((r) => r.base));
  const byRemainder = [...rows].sort((a, b) => b.remainder - a.remainder || a.order - b.order);
  for (const row of byRemainder) {
    if (leftover <= 0) break;
    if (row.remainder === 0) continue; // 整除的人不該拿零頭
    row.base += 1;
    leftover--;
  }
  const result: Record<ID, Money> = {};
  for (const r of rows) result[r.id] = r.base;
  return result;
}

/** 依旅程成員順序，取出 spec 中實際參與分攤的人 */
export function participantsOf(spec: SplitSpec, memberOrder: ID[]): ID[] {
  switch (spec.type) {
    case 'equal': {
      const set = new Set(spec.participants);
      return memberOrder.filter((id) => set.has(id));
    }
    case 'shares':
      return memberOrder.filter((id) => (spec.shares[id] ?? 0) > 0);
    case 'exact':
      return memberOrder.filter((id) => (spec.amounts[id] ?? 0) > 0);
  }
}

function specMemberIds(spec: SplitSpec): ID[] {
  switch (spec.type) {
    case 'equal':
      return spec.participants;
    case 'shares':
      return Object.keys(spec.shares);
    case 'exact':
      return Object.keys(spec.amounts);
  }
}

export function validateSplit(amount: Money, spec: SplitSpec, memberOrder: ID[]): SplitValidation {
  if (!isValidAmount(amount)) return { ok: false, reason: 'invalidAmount' };
  const known = new Set(memberOrder);
  if (specMemberIds(spec).some((id) => !known.has(id))) return { ok: false, reason: 'unknownMember' };

  switch (spec.type) {
    case 'equal':
      break;
    case 'shares': {
      const values = Object.values(spec.shares);
      if (values.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1000)) {
        return { ok: false, reason: 'invalidShare' };
      }
      // 只接受小數點後 2 位以內
      if (values.some((v) => Math.abs(v * SHARE_SCALE - Math.round(v * SHARE_SCALE)) > 1e-9)) {
        return { ok: false, reason: 'invalidShare' };
      }
      break;
    }
    case 'exact': {
      const values = Object.values(spec.amounts);
      if (values.some((v) => !isNonNegativeMoney(v))) return { ok: false, reason: 'invalidExactAmount' };
      const diff = amount - sum(values);
      if (diff !== 0) return { ok: false, reason: 'exactMismatch', diff };
      break;
    }
  }
  if (participantsOf(spec, memberOrder).length === 0) return { ok: false, reason: 'noParticipants' };
  return { ok: true };
}

/**
 * 計算一筆支出每個人應分攤多少。回傳只包含有分攤的人，總和保證等於 amount。
 * spec 不合法時丟出 SplitError。
 */
export function splitExpense(amount: Money, spec: SplitSpec, memberOrder: ID[]): Record<ID, Money> {
  const validation = validateSplit(amount, spec, memberOrder);
  if (!validation.ok) throw new SplitError(validation);
  const participants = participantsOf(spec, memberOrder);

  switch (spec.type) {
    case 'equal':
      return splitEqual(amount, participants);
    case 'shares':
      return splitShares(
        amount,
        participants.map((id) => ({ id, share: spec.shares[id] })),
      );
    case 'exact': {
      const result: Record<ID, Money> = {};
      for (const id of participants) result[id] = spec.amounts[id];
      return result;
    }
  }
}
