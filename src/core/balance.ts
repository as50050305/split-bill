import { sum } from './money';
import { settleGreedy, settlePool } from './settle';
import { splitExpense } from './split';
import type { Contribution, Expense, ID, Money, Payment, Transfer, Trip } from './types';

export interface MemberBalance {
  memberId: ID;
  /** 模式二：付過的支出；模式一：投入公費 + 自掏腰包代墊 */
  paid: Money;
  /** 模式一細分：投入公費 */
  contributed: Money;
  /** 模式一細分：代墊 */
  advanced: Money;
  /** 應分攤 */
  owed: Money;
  /** 已還款：付出去 / 收到 */
  sent: Money;
  received: Money;
  /** 已付 − 應付（不含已還款） */
  net: Money;
  /** 結算用部位：net + sent − received（模式一保管人再扣掉手上公費）。正＝還該收、負＝還該付 */
  position: Money;
}

export interface TripSummary {
  balances: MemberBalance[];
  /** 尚未還款的建議轉帳 */
  transfers: Transfer[];
  totalExpense: Money;
  /** 模式一：目前公費餘額（投入 − 由公費支付的支出） */
  poolBalance: Money;
  totalContributed: Money;
}

export interface TripLedger {
  trip: Pick<Trip, 'mode' | 'members' | 'custodianId'>;
  expenses: Expense[];
  contributions: Contribution[];
  payments: Payment[];
}

export function computeTripSummary({ trip, expenses, contributions, payments }: TripLedger): TripSummary {
  const order = trip.members.map((m) => m.id);
  const rows = new Map<ID, MemberBalance>(
    order.map((id) => [
      id,
      { memberId: id, paid: 0, contributed: 0, advanced: 0, owed: 0, sent: 0, received: 0, net: 0, position: 0 },
    ]),
  );
  const row = (id: ID) => {
    const r = rows.get(id);
    if (!r) throw new Error(`unknown member ${id}`);
    return r;
  };

  let poolSpent = 0;
  for (const e of expenses) {
    const shares = splitExpense(e.amount, e.split, order);
    for (const [id, v] of Object.entries(shares)) row(id).owed += v;

    // 補貼（油錢）在計算上等同「收補貼的人先付了這筆」：他應該拿回這筆錢，大家依分攤方式出
    const payers = Object.entries(e.payers ?? {}).filter(([, v]) => v > 0);
    if (payers.length && sum(payers.map(([, v]) => v)) !== e.amount) {
      throw new Error(`expense ${e.id} payers do not add up`);
    }
    if (trip.mode === 'individual') {
      if (!payers.length) throw new Error(`expense ${e.id} has no payer`);
      for (const [id, v] of payers) row(id).paid += v;
    } else if (payers.length) {
      for (const [id, v] of payers) row(id).advanced += v; // 代墊：視為投入同額公費後由公費支出
    } else {
      poolSpent += e.amount;
    }
  }

  if (trip.mode === 'pool') {
    for (const c of contributions) row(c.memberId).contributed += c.amount;
    for (const r of rows.values()) r.paid = r.contributed + r.advanced;
  }

  for (const p of payments) {
    row(p.fromId).sent += p.amount;
    row(p.toId).received += p.amount;
  }

  const totalContributed = sum(contributions.map((c) => c.amount));
  const poolBalance = trip.mode === 'pool' ? totalContributed - poolSpent : 0;

  for (const r of rows.values()) {
    r.net = r.paid - r.owed;
    r.position = r.net + r.sent - r.received;
  }

  let transfers: Transfer[];
  const positions: Record<ID, Money> = {};
  for (const r of rows.values()) positions[r.memberId] = r.position;

  if (trip.mode === 'pool') {
    const custodian = trip.custodianId;
    if (!custodian || !rows.has(custodian)) throw new Error('pool trip needs a custodian');
    // 保管人手上握著公費餘額，那是大家的錢，所以他的部位要扣掉
    positions[custodian] -= poolBalance;
    row(custodian).position = positions[custodian];
    transfers = settlePool(positions, custodian, order);
  } else {
    transfers = settleGreedy(positions, order);
  }

  return {
    balances: order.map((id) => row(id)),
    transfers,
    totalExpense: sum(expenses.map((e) => e.amount)),
    poolBalance,
    totalContributed,
  };
}
