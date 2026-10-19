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

    if (trip.mode === 'individual') {
      if (!e.payerId) throw new Error(`expense ${e.id} has no payer`);
      row(e.payerId).paid += e.amount;
    } else if (e.payerId) {
      row(e.payerId).advanced += e.amount; // 代墊：視為投入同額公費後由公費支出
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
