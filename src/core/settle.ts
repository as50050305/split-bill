import type { ID, Money, Transfer } from './types';

/**
 * 模式二：最少轉帳次數（貪婪法）。
 * 每一輪取「最大債權人」配對「最大債務人」，轉兩者較小的金額；
 * 金額相同時依成員名單順序（排前面的先處理），確保結果可預期。
 *
 * positions：每人淨額（正＝別人該給他、負＝他該給別人），總和必須為 0。
 */
export function settleGreedy(positions: Record<ID, Money>, memberOrder: ID[]): Transfer[] {
  assertBalanced(positions);
  const order = new Map(memberOrder.map((id, i) => [id, i]));
  const rank = (id: ID) => order.get(id) ?? Number.MAX_SAFE_INTEGER;

  const creditors = Object.entries(positions)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, left: v }));
  const debtors = Object.entries(positions)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, left: -v }));

  const pickMax = (list: { id: ID; left: Money }[]) =>
    list
      .filter((x) => x.left > 0)
      .sort((a, b) => b.left - a.left || rank(a.id) - rank(b.id))[0];

  const transfers: Transfer[] = [];
  for (;;) {
    const c = pickMax(creditors);
    const d = pickMax(debtors);
    if (!c || !d) break;
    const amount = Math.min(c.left, d.left);
    transfers.push({ fromId: d.id, toId: c.id, amount });
    c.left -= amount;
    d.left -= amount;
  }
  return transfers;
}

/**
 * 模式一：所有轉帳都經過保管人。
 * positions 已包含保管人手上握有的公費（見 computeBalances），總和為 0。
 * 正數的人 → 保管人退給他；負數的人 → 補給保管人。
 */
export function settlePool(positions: Record<ID, Money>, custodianId: ID, memberOrder: ID[]): Transfer[] {
  assertBalanced(positions);
  const transfers: Transfer[] = [];
  for (const id of memberOrder) {
    if (id === custodianId) continue;
    const v = positions[id] ?? 0;
    if (v > 0) transfers.push({ fromId: custodianId, toId: id, amount: v });
    else if (v < 0) transfers.push({ fromId: id, toId: custodianId, amount: -v });
  }
  return transfers;
}

function assertBalanced(positions: Record<ID, Money>) {
  const total = Object.values(positions).reduce((a, b) => a + b, 0);
  if (total !== 0) throw new Error(`positions must sum to 0, got ${total}`);
}
