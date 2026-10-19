/**
 * 需求文件中的 5 個驗證案例。全部通過才算完成。
 * 金額內部以「分」計算（y(300) = 300 元 = 30000 分）；轉帳預設取整數元。
 */
import { describe, expect, it } from 'vitest';
import { computeTripSummary, splitEqual, validateExpense } from '..';
import { contribution, expense, trip, y } from './helpers';

describe('驗證案例', () => {
  it('1. 模式二：A 付 300，三人（A、B、C）平分 → B 轉 A 100、C 轉 A 100', () => {
    const s = computeTripSummary({
      trip: trip('individual', ['A', 'B', 'C'], undefined, 'yuan'),
      expenses: [expense({ amount: y(300), payerId: 'A', split: { type: 'equal', participants: ['A', 'B', 'C'] } })],
      contributions: [],
      payments: [],
    });
    expect(s.transfers).toEqual([
      { fromId: 'B', toId: 'A', amount: y(100) },
      { fromId: 'C', toId: 'A', amount: y(100) },
    ]);
  });

  it('2. 模式二：A 付 1000、B 付 500，四人平分 → C→A 375、D→A 250、D→B 125', () => {
    const all = { type: 'equal' as const, participants: ['A', 'B', 'C', 'D'] };
    const s = computeTripSummary({
      trip: trip('individual', ['A', 'B', 'C', 'D'], undefined, 'yuan'),
      expenses: [expense({ amount: y(1000), payerId: 'A', split: all }), expense({ amount: y(500), payerId: 'B', split: all })],
      contributions: [],
      payments: [],
    });
    expect(s.balances.map((b) => b.owed)).toEqual([y(375), y(375), y(375), y(375)]);
    expect(s.balances.map((b) => b.net)).toEqual([y(625), y(125), y(-375), y(-375)]);
    expect(s.transfers).toEqual([
      { fromId: 'C', toId: 'A', amount: y(375) },
      { fromId: 'D', toId: 'A', amount: y(250) },
      { fromId: 'D', toId: 'B', amount: y(125) },
    ]);
  });

  it('3.（v3 改為精確到小數 2 位）平分 100 元給三人 → 33.34、33.33、33.33，總和 100', () => {
    const r = splitEqual(y(100), ['A', 'B', 'C']);
    expect(r).toEqual({ A: 3334, B: 3333, C: 3333 });
    expect(r.A + r.B + r.C).toBe(y(100));
  });

  it('4. 模式一：A、B、C 各投入 1000，支出 2400 三人平分 → 保管人退每人 200', () => {
    const s = computeTripSummary({
      trip: trip('pool', ['A', 'B', 'C'], 'A', 'yuan'),
      expenses: [expense({ amount: y(2400), split: { type: 'equal', participants: ['A', 'B', 'C'] } })],
      contributions: ['A', 'B', 'C'].map((id) => contribution(id, y(1000))),
      payments: [],
    });
    expect(s.poolBalance).toBe(y(600));
    expect(s.balances.map((b) => b.net)).toEqual([y(200), y(200), y(200)]);
    expect(s.transfers).toEqual([
      { fromId: 'A', toId: 'B', amount: y(200) },
      { fromId: 'A', toId: 'C', amount: y(200) },
    ]);
  });

  it('5. 指定金額總和不等於支出金額時，不能存檔', () => {
    const t = trip('individual', ['A', 'B', 'C']);
    const base = { title: '晚餐', amount: y(1000), categoryId: 'food' as const, date: '2026-10-19', payers: { A: y(1000) } };
    const errors = validateExpense({ ...base, split: { type: 'exact', amounts: { A: y(300), B: y(300), C: y(300) } } }, t);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ field: 'split', detail: { reason: 'exactMismatch', diff: y(100) } });

    const ok = validateExpense({ ...base, split: { type: 'exact', amounts: { A: y(400), B: y(300), C: y(300) } } }, t);
    expect(ok).toEqual([]);
  });
});
