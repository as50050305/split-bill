/**
 * 把計算過程整理成「人看得懂的算式」，給計算公式頁用。純函式、不做任何判斷改變結果。
 */
import { CENTS, formatMoney } from './money';
import { SHARE_SCALE, participantsOf, splitExpense } from './split';
import type { Expense, ID, Money } from './types';

export interface SplitExplanation {
  method: string;
  /** 主算式，例如「1,000 ÷ 3 人 = 333.333…」 */
  formula: string;
  rows: { id: ID; value: Money; detail?: string }[];
  /** 零頭怎麼分 */
  note?: string;
}

/** 分子 / 分母（分子單位為「分」），顯示到元的小數 4 位，除不盡加「…」 */
export function divideToText(numeratorCents: bigint, denominator: bigint): string {
  const scaled = (numeratorCents * 100n) / denominator; // 單位：1/10000 元
  const exact = (numeratorCents * 100n) % denominator === 0n;
  const int = scaled / 10000n;
  let frac = (scaled % 10000n).toString().padStart(4, '0');
  if (exact) frac = frac.replace(/0+$/, '');
  const intText = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (frac ? `${intText}.${frac}` : intText) + (exact ? '' : '…');
}

export function explainSplit(e: Expense, memberOrder: ID[], nameOf: (id: ID) => string): SplitExplanation {
  const result = splitExpense(e.amount, e.split, memberOrder);
  const people = participantsOf(e.split, memberOrder);
  const amt = formatMoney(e.amount);

  if (e.split.type === 'equal') {
    const n = people.length;
    const base = Math.floor(e.amount / n);
    const extra = people.filter((id) => result[id] > base);
    return {
      method: '平均分攤',
      formula: `${amt} ÷ ${n} 人 = ${divideToText(BigInt(e.amount), BigInt(n))}`,
      rows: people.map((id) => ({ id, value: result[id] })),
      note: extra.length
        ? `除不盡剩 ${extra.length} 分錢，依名單順序給 ${extra.map(nameOf).join('、')} 各多 0.01`
        : undefined,
    };
  }

  if (e.split.type === 'shares') {
    const shares = e.split.shares;
    const units = people.map((id) => Math.round(shares[id] * SHARE_SCALE));
    const totalUnits = units.reduce((a, b) => a + b, 0);
    const totalShares = totalUnits / SHARE_SCALE;
    const rows = people.map((id, i) => ({
      id,
      value: result[id],
      detail: `${amt} × ${shares[id]} ÷ ${totalShares} = ${divideToText(BigInt(e.amount) * BigInt(units[i]), BigInt(totalUnits))}`,
    }));
    const floors = people.map((_pid, i) => Math.floor((e.amount * units[i]) / totalUnits));
    const extra = people.filter((pid, i) => result[pid] > floors[i]);
    return {
      method: '依份數分攤',
      formula: `共 ${totalShares} 份，每份 ${amt} ÷ ${totalShares} = ${divideToText(BigInt(e.amount) * BigInt(SHARE_SCALE), BigInt(totalUnits))}`,
      rows,
      note: extra.length
        ? `除不盡剩 ${extra.length} 分錢，依「小數部分最大」給 ${extra.map(nameOf).join('、')} 各多 0.01`
        : undefined,
    };
  }

  return {
    method: '指定金額',
    formula: `${people.map((id) => formatMoney(result[id])).join(' + ')} = ${amt}`,
    rows: people.map((id) => ({ id, value: result[id] })),
  };
}

/** 一個人的應付明細：哪幾筆、各多少 */
export function owedBreakdown(expenses: Expense[], memberOrder: ID[], memberId: ID) {
  const items: { title: string; value: Money }[] = [];
  for (const e of expenses) {
    const v = splitExpense(e.amount, e.split, memberOrder)[memberId];
    if (v) items.push({ title: e.title, value: v });
  }
  return items;
}

/** 一個人的已付明細 */
export function paidBreakdown(expenses: Expense[], memberId: ID) {
  return expenses
    .filter((e) => (e.payers?.[memberId] ?? 0) > 0)
    .map((e) => ({ title: e.title, value: e.payers[memberId], subsidy: e.kind === 'subsidy' }));
}

export const isWholeYuan = (v: Money) => v % CENTS === 0;
