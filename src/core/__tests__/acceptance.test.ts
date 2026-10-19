/**
 * 需求文件中的 5 個驗證案例。全部通過才算完成。
 */
import { describe, expect, it } from 'vitest';
import { computeTripSummary, splitEqual, validateExpense } from '..';
import { contribution, expense, trip } from './helpers';

describe('驗證案例', () => {
  it('1. 模式二：A 付 300，三人平分 → B 轉 A 100、C 轉 A 100', () => {
    const t = trip('individual', ['A', 'B', 'C']);
    const s = computeTripSummary({
      trip: t,
      expenses: [expense({ amount: 300, payerId: 'A', split: { type: 'equal', participants: ['A', 'B', 'C'] } })],
      contributions: [],
      payments: [],
    });
    expect(s.transfers).toEqual([
      { fromId: 'B', toId: 'A', amount: 100 },
      { fromId: 'C', toId: 'A', amount: 100 },
    ]);
  });

  it('2. 模式二：A 付 1000、B 付 500，四人平分 → C→A 375、D→A 250、D→B 125', () => {
    const t = trip('individual', ['A', 'B', 'C', 'D']);
    const all = { type: 'equal' as const, participants: ['A', 'B', 'C', 'D'] };
    const s = computeTripSummary({
      trip: t,
      expenses: [expense({ amount: 1000, payerId: 'A', split: all }), expense({ amount: 500, payerId: 'B', split: all })],
      contributions: [],
      payments: [],
    });
    expect(s.balances.map((b) => b.owed)).toEqual([375, 375, 375, 375]);
    expect(s.balances.map((b) => b.net)).toEqual([625, 125, -375, -375]);
    expect(s.transfers).toEqual([
      { fromId: 'C', toId: 'A', amount: 375 },
      { fromId: 'D', toId: 'A', amount: 250 },
      { fromId: 'D', toId: 'B', amount: 125 },
    ]);
    expect(s.transfers.length).toBeLessThanOrEqual(3);
  });

  it('3. 平分 100 元給三人 → 34、33、33，總和 100', () => {
    const r = splitEqual(100, ['A', 'B', 'C']);
    expect(r).toEqual({ A: 34, B: 33, C: 33 });
    expect(r.A + r.B + r.C).toBe(100);
  });

  it('4. 模式一：A、B、C 各投入 1000，支出 2400 三人平分 → 保管人退每人 200', () => {
    const t = trip('pool', ['A', 'B', 'C'], 'A');
    const s = computeTripSummary({
      trip: t,
      expenses: [expense({ amount: 2400, split: { type: 'equal', participants: ['A', 'B', 'C'] } })],
      contributions: ['A', 'B', 'C'].map((id) => contribution(id, 1000)),
      payments: [],
    });
    expect(s.poolBalance).toBe(600);
    // 每人「投入 − 應分攤」都是 +200
    expect(s.balances.map((b) => b.net)).toEqual([200, 200, 200]);
    // 保管人 A 退 B、C 各 200，自己那 200 留在手上
    expect(s.transfers).toEqual([
      { fromId: 'A', toId: 'B', amount: 200 },
      { fromId: 'A', toId: 'C', amount: 200 },
    ]);
  });

  it('5. 指定金額總和不等於支出金額時，不能存檔', () => {
    const t = trip('individual', ['A', 'B', 'C']);
    const errors = validateExpense(
      {
        title: '晚餐',
        amount: 1000,
        categoryId: 'food',
        date: '2026-10-19',
        payers: { A: 1000 },
        split: { type: 'exact', amounts: { A: 300, B: 300, C: 300 } },
      },
      t,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ field: 'split', detail: { reason: 'exactMismatch', diff: 100 } });

    const ok = validateExpense(
      {
        title: '晚餐',
        amount: 1000,
        categoryId: 'food',
        date: '2026-10-19',
        payers: { A: 1000 },
        split: { type: 'exact', amounts: { A: 400, B: 300, C: 300 } },
      },
      t,
    );
    expect(ok).toEqual([]);
  });
});
