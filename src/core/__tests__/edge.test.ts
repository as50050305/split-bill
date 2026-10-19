import { describe, expect, it } from 'vitest';
import {
  computeTripSummary,
  formatMoney,
  parseMoney,
  settleGreedy,
  splitExpense,
  splitShares,
  validateExpense,
  validateSplit,
} from '..';
import { contribution, expense, payment, trip } from './helpers';

const sumOf = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe('平均分攤', () => {
  it('零頭依名單順序給前面的人（依旅程成員順序，不是勾選順序）', () => {
    expect(splitExpense(101, { type: 'equal', participants: ['D', 'B', 'A'] }, ['A', 'B', 'C', 'D'])).toEqual({
      A: 34,
      B: 34,
      D: 33,
    });
  });
  it('排除的人不分攤', () => {
    const r = splitExpense(100, { type: 'equal', participants: ['A', 'C'] }, ['A', 'B', 'C']);
    expect(r).toEqual({ A: 50, C: 50 });
  });
  it('大量隨機案例總和永遠等於支出', () => {
    for (let i = 0; i < 500; i++) {
      const n = 1 + (i % 9);
      const ids = Array.from({ length: n }, (_, k) => `m${k}`);
      const amount = 1 + ((i * 7919) % 100000);
      expect(sumOf(splitExpense(amount, { type: 'equal', participants: ids }, ids))).toBe(amount);
    }
  });
  it('沒有人分攤時不合法', () => {
    expect(validateSplit(100, { type: 'equal', participants: [] }, ['A'])).toMatchObject({
      ok: false,
      reason: 'noParticipants',
    });
  });
});

describe('指定份數（最大餘數法）', () => {
  it('100 元按 0.5 / 1 / 2 份 → 14 / 29 / 57', () => {
    const r = splitShares(100, [
      { id: 'A', share: 0.5 },
      { id: 'B', share: 1 },
      { id: 'C', share: 2 },
    ]);
    expect(r).toEqual({ A: 14, B: 29, C: 57 });
  });
  it('餘數相同時依名單順序', () => {
    expect(splitShares(100, ['A', 'B', 'C'].map((id) => ({ id, share: 1 })))).toEqual({ A: 34, B: 33, C: 33 });
  });
  it('0 份＝排除', () => {
    expect(splitExpense(90, { type: 'shares', shares: { A: 1, B: 0, C: 2 } }, ['A', 'B', 'C'])).toEqual({
      A: 30,
      C: 60,
    });
  });
  it('份數只接受小數點後 2 位、不可為負', () => {
    expect(validateSplit(100, { type: 'shares', shares: { A: 0.333 } }, ['A']).ok).toBe(false);
    expect(validateSplit(100, { type: 'shares', shares: { A: -1, B: 1 } }, ['A', 'B']).ok).toBe(false);
    expect(validateSplit(100, { type: 'shares', shares: { A: 0.25, B: 1.75 } }, ['A', 'B']).ok).toBe(true);
  });
  it('隨機份數總和永遠等於支出', () => {
    for (let i = 1; i < 500; i++) {
      const shares = { A: (i % 7) * 0.5 + 0.5, B: (i % 3) + 0.25, C: (i % 11) * 0.1 + 0.1 };
      const amount = (i * 104729) % 50000 + 1;
      const r = splitExpense(amount, { type: 'shares', shares }, ['A', 'B', 'C']);
      expect(sumOf(r)).toBe(amount);
    }
  });
});

describe('指定金額', () => {
  it('差額為負（輸入太多）也會回報', () => {
    expect(validateSplit(100, { type: 'exact', amounts: { A: 80, B: 30 } }, ['A', 'B'])).toEqual({
      ok: false,
      reason: 'exactMismatch',
      diff: -10,
    });
  });
  it('金額 0 的人視為不分攤', () => {
    expect(splitExpense(100, { type: 'exact', amounts: { A: 100, B: 0 } }, ['A', 'B'])).toEqual({ A: 100 });
  });
});

describe('結算', () => {
  it('已還款紀錄會從剩餘轉帳扣掉', () => {
    const t = trip('individual', ['A', 'B', 'C']);
    const all = { type: 'equal' as const, participants: ['A', 'B', 'C'] };
    const s = computeTripSummary({
      trip: t,
      expenses: [expense({ amount: 300, payerId: 'A', split: all })],
      contributions: [],
      payments: [payment('B', 'A', 100)],
    });
    expect(s.transfers).toEqual([{ fromId: 'C', toId: 'A', amount: 100 }]);
    // 已付／應付／淨額不受還款影響
    expect(s.balances.find((b) => b.memberId === 'B')).toMatchObject({ paid: 0, owed: 100, net: -100, position: 0 });
  });

  it('還款後再加支出，只算剩下的差額', () => {
    const t = trip('individual', ['A', 'B']);
    const all = { type: 'equal' as const, participants: ['A', 'B'] };
    const s = computeTripSummary({
      trip: t,
      expenses: [expense({ amount: 200, payerId: 'A', split: all }), expense({ amount: 100, payerId: 'B', split: all })],
      contributions: [],
      payments: [payment('B', 'A', 100)],
    });
    // 原本 B 欠 A 100 已還；後來 B 付 100 → A 欠 B 50
    expect(s.transfers).toEqual([{ fromId: 'A', toId: 'B', amount: 50 }]);
  });

  it('全部結清時沒有轉帳', () => {
    expect(settleGreedy({ A: 0, B: 0 }, ['A', 'B'])).toEqual([]);
  });

  it('部位總和不為 0 時丟錯（防止帳不平卻默默算錯）', () => {
    expect(() => settleGreedy({ A: 10, B: -5 }, ['A', 'B'])).toThrow();
  });

  it('模式一：有人沒投夠要補給保管人', () => {
    const t = trip('pool', ['A', 'B', 'C'], 'B');
    const s = computeTripSummary({
      trip: t,
      expenses: [expense({ amount: 900, split: { type: 'equal', participants: ['A', 'B', 'C'] } })],
      contributions: [contribution('A', 600), contribution('B', 300)],
      payments: [],
    });
    expect(s.poolBalance).toBe(0);
    expect(s.transfers).toEqual([
      { fromId: 'B', toId: 'A', amount: 300 },
      { fromId: 'C', toId: 'B', amount: 300 },
    ]);
  });

  it('模式一：代墊視為投入公費', () => {
    const t = trip('pool', ['A', 'B'], 'A');
    const all = { type: 'equal' as const, participants: ['A', 'B'] };
    const s = computeTripSummary({
      trip: t,
      expenses: [expense({ amount: 400, split: all }), expense({ amount: 200, payerId: 'B', split: all })],
      contributions: [contribution('A', 500), contribution('B', 500)],
      payments: [],
    });
    expect(s.poolBalance).toBe(600); // 代墊不從公費扣
    expect(s.balances[1]).toMatchObject({ contributed: 500, advanced: 200, paid: 700, owed: 300, net: 400 });
    expect(s.transfers).toEqual([{ fromId: 'A', toId: 'B', amount: 400 }]);
  });

  it('模式一：保管人退款後標記已還款 → 沒有剩餘轉帳', () => {
    const t = trip('pool', ['A', 'B', 'C'], 'A');
    const s = computeTripSummary({
      trip: t,
      expenses: [expense({ amount: 2400, split: { type: 'equal', participants: ['A', 'B', 'C'] } })],
      contributions: ['A', 'B', 'C'].map((id) => contribution(id, 1000)),
      payments: [payment('A', 'B', 200), payment('A', 'C', 200)],
    });
    expect(s.transfers).toEqual([]);
  });

  it('模式二：沒有付款人不能存檔', () => {
    const errors = validateExpense(
      { title: 'x', amount: 10, categoryId: 'food', date: '2026-10-19', payers: {}, split: { type: 'equal', participants: ['A'] } },
      trip('individual', ['A']),
    );
    expect(errors).toEqual([{ field: 'payer', code: 'required' }]);
  });
});

describe('金額工具', () => {
  it('parseMoney 只接受非負整數', () => {
    expect(parseMoney('1,234')).toBe(1234);
    expect(parseMoney('12.5')).toBeNull();
    expect(parseMoney('-3')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });
  it('formatMoney 加千分位', () => {
    expect(formatMoney(1234567)).toBe('1,234,567');
    expect(formatMoney(-375)).toBe('-375');
  });
});

describe('多人付款與補貼', () => {
  const all3 = { type: 'equal' as const, participants: ['A', 'B', 'C'] };

  it('桌菜 3000：A 出 2000、B 出 1000，三人平分 → C 轉 A 1000', () => {
    const s = computeTripSummary({
      trip: trip('individual', ['A', 'B', 'C']),
      expenses: [expense({ amount: 3000, payers: { A: 2000, B: 1000 }, split: all3 })],
      contributions: [],
      payments: [],
    });
    expect(s.balances.map((b) => b.paid)).toEqual([2000, 1000, 0]);
    expect(s.transfers).toEqual([{ fromId: 'C', toId: 'A', amount: 1000 }]);
  });

  it('付款人金額總和不等於支出 → 不能存檔，並回報差額', () => {
    const errors = validateExpense(
      { title: '桌菜', amount: 3000, categoryId: 'food', date: '2026-10-19', payers: { A: 2000, B: 500 }, split: all3 },
      trip('individual', ['A', 'B', 'C']),
    );
    expect(errors).toEqual([{ field: 'payer', code: 'mismatch', diff: 500 }]);
  });

  it('油錢補貼 900 給兩位開車的人（各 450），開車的人不分攤 → 乘客各轉 450', () => {
    const s = computeTripSummary({
      trip: trip('individual', ['A', 'B', 'C', 'D']),
      expenses: [
        expense({ amount: 900, kind: 'subsidy', payers: { A: 450, B: 450 }, split: { type: 'equal', participants: ['C', 'D'] } }),
      ],
      contributions: [],
      payments: [],
    });
    expect(s.transfers).toEqual([
      { fromId: 'C', toId: 'A', amount: 450 },
      { fromId: 'D', toId: 'B', amount: 450 },
    ]);
  });

  it('補貼一定要選收補貼的人（公費制也一樣）', () => {
    const errors = validateExpense(
      { title: '油錢', amount: 500, kind: 'subsidy', categoryId: 'transport', date: '2026-10-19', payers: {}, split: all3 },
      trip('pool', ['A', 'B', 'C'], 'A'),
    );
    expect(errors).toEqual([{ field: 'payer', code: 'required' }]);
  });

  it('公費制：補貼給開車的 B，由保管人從公費結算給他', () => {
    const s = computeTripSummary({
      trip: trip('pool', ['A', 'B', 'C'], 'A'),
      expenses: [expense({ amount: 600, kind: 'subsidy', payers: { B: 600 }, split: all3 })],
      contributions: ['A', 'B', 'C'].map((id) => contribution(id, 1000)),
      payments: [],
    });
    expect(s.poolBalance).toBe(3000);
    // 每人應付 200；B 另外拿到 600 補貼
    expect(s.transfers).toEqual([
      { fromId: 'A', toId: 'B', amount: 1400 },
      { fromId: 'A', toId: 'C', amount: 800 },
    ]);
  });

  it('公費制：兩人合力代墊', () => {
    const s = computeTripSummary({
      trip: trip('pool', ['A', 'B', 'C'], 'A'),
      expenses: [expense({ amount: 900, payers: { B: 500, C: 400 }, split: all3 })],
      contributions: [],
      payments: [],
    });
    expect(s.balances.map((b) => b.advanced)).toEqual([0, 500, 400]);
    expect(s.transfers).toEqual([
      { fromId: 'A', toId: 'B', amount: 200 },
      { fromId: 'A', toId: 'C', amount: 100 },
    ]);
  });
});

describe('資料升級', () => {
  it('舊版 payerId 自動轉成 payers', async () => {
    const { migrate } = await import('../../data/migrations');
    const d = migrate({
      schemaVersion: 1,
      expenses: [
        { id: 'e1', amount: 300, payerId: 'A' },
        { id: 'e2', amount: 100 },
      ],
    });
    expect(d.schemaVersion).toBe(2);
    expect(d.expenses[0]).toMatchObject({ payers: { A: 300 }, kind: 'expense' });
    expect(d.expenses[0]).not.toHaveProperty('payerId');
    expect(d.expenses[1]).toMatchObject({ payers: {} });
  });
});
