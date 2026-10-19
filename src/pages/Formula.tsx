import { useMemo } from 'react';
import { computeTripSummary } from '../core/balance';
import { categoryOf } from '../core/categories';
import { explainSplit, owedBreakdown, paidBreakdown } from '../core/explain';
import { formatMoney, sum } from '../core/money';
import type { Expense, ID, Money } from '../core/types';
import { Icon } from '../components/icons';
import { AppBar, Avatar, Empty } from '../components/ui';
import { tripLedger } from '../store/actions';
import { useStore } from '../store/AppStore';
import { cx, formatDate } from '../utils';
import { NotFound } from './TripForm';

const fm = (v: Money) => formatMoney(v, 'always');
const signed = (v: Money) => (v > 0 ? '+' : '') + fm(v);

/** 「計算公式」頁：把每一步怎麼算出來的攤開給大家看 */
export function Formula({ tripId }: { tripId: string }) {
  const { data } = useStore();
  const trip = data.trips.find((t) => t.id === tripId);
  const ledger = useMemo(() => tripLedger(data, tripId), [data, tripId]);
  const summary = useMemo(() => {
    if (!trip) return null;
    try {
      return computeTripSummary({ trip, ...ledger });
    } catch {
      return null;
    }
  }, [trip, ledger]);
  if (!trip) return <NotFound />;

  const order = trip.members.map((m) => m.id);
  const name = (id: ID) => trip.members.find((m) => m.id === id)?.name ?? '?';
  const idx = (id: ID) => order.indexOf(id);
  const isPool = trip.mode === 'pool';
  const expenses = [...ledger.expenses].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const rounding = trip.rounding ?? 'yuan';

  const payerText = (e: Expense) => {
    const ids = order.filter((id) => (e.payers?.[id] ?? 0) > 0);
    const list = ids.map((id) => (ids.length > 1 ? `${name(id)} ${formatMoney(e.payers[id])}` : name(id))).join('、');
    if (e.kind === 'subsidy') return `補貼給 ${list}`;
    if (!ids.length) return '公費支付';
    return isPool ? `${list} 代墊` : `${list} 付`;
  };

  return (
    <>
      <AppBar eyebrow={trip.name} title="計算公式" back={{ name: 'trip', tripId, tab: 'settle' }} />
      <main className="page formula">
        {!summary ? (
          <Empty icon="receipt" tone="rose" title="資料有誤，無法計算" />
        ) : expenses.length === 0 ? (
          <Empty icon="receipt" tone="clay" title="還沒有支出" hint="記帳後這裡會列出每一步的算式" />
        ) : (
          <>
            <p className="note" style={{ paddingTop: 0 }}>
              所有金額都精確計算到小數 2 位（分），不會因為品項多而累積誤差。
              {rounding === 'yuan' ? '只有最後的轉帳金額才取整數元。' : '轉帳金額也顯示到小數 2 位。'}
            </p>

            {/* ── 1. 每筆怎麼分 ── */}
            <h2 className="f-h">
              <span className="f-step">1</span>每筆支出怎麼分
            </h2>
            <div className="stack">
              {expenses.map((e) => {
                const ex = explainSplit(e, order, name);
                const cat = categoryOf(e.categoryId);
                return (
                  <section key={e.id} className="card f-card">
                    <header className="f-card-head">
                      <span className={`tile tone-${cat.tone}`} style={{ width: 36, height: 36, borderRadius: 10 }}>
                        <Icon name={e.categoryId} size={18} />
                      </span>
                      <div className="grow">
                        <div className="f-title">{e.title}</div>
                        <div className="f-sub">
                          {formatDate(e.date)} · {payerText(e)}
                        </div>
                      </div>
                      <span className="f-amt num">{formatMoney(e.amount)}</span>
                    </header>
                    <div className="f-method">{ex.method}</div>
                    <div className="f-formula num">{ex.formula}</div>
                    <ul className="f-rows">
                      {ex.rows.map((r) => (
                        <li key={r.id}>
                          <span className="who">
                            <Avatar name={name(r.id)} index={idx(r.id)} small />
                            {name(r.id)}
                          </span>
                          {r.detail && <span className="f-detail num">{r.detail}</span>}
                          <span className="num f-val">{fm(r.value)}</span>
                        </li>
                      ))}
                    </ul>
                    {ex.note && <p className="f-note">{ex.note}</p>}
                  </section>
                );
              })}
            </div>

            {/* ── 2. 每個人的帳 ── */}
            <h2 className="f-h">
              <span className="f-step">2</span>每個人的帳
            </h2>
            <div className="stack">
              {summary.balances.map((b) => {
                const owed = owedBreakdown(ledger.expenses, order, b.memberId);
                const paid = paidBreakdown(ledger.expenses, b.memberId);
                const contributions = ledger.contributions.filter((c) => c.memberId === b.memberId);
                const paidItems = [
                  ...contributions.map((c) => ({ title: `投入公費（${formatDate(c.date)}）`, value: c.amount })),
                  ...paid.map((p) => ({ title: p.subsidy ? `${p.title}（收補貼）` : isPool ? `${p.title}（代墊）` : p.title, value: p.value })),
                ];
                return (
                  <section key={b.memberId} className="card f-card">
                    <header className="f-card-head">
                      <Avatar name={name(b.memberId)} index={idx(b.memberId)} />
                      <div className="grow f-title">
                        {name(b.memberId)}
                        {isPool && b.memberId === trip.custodianId && <span className="badge" style={{ marginLeft: 8 }}>保管人</span>}
                      </div>
                      <span className={cx('f-amt num', b.net > 0 ? 'pos' : b.net < 0 ? 'neg' : 'muted')}>{signed(b.net)}</span>
                    </header>
                    <Breakdown label={isPool ? '投入（含代墊、補貼）' : '已付（含收到的補貼）'} items={paidItems} total={b.paid} />
                    <Breakdown label="應付" items={owed} total={b.owed} />
                    <div className="f-formula num">
                      淨額 = {fm(b.paid)} − {fm(b.owed)} = {signed(b.net)}
                    </div>
                    {(b.sent > 0 || b.received > 0) && (
                      <div className="f-formula num">
                        扣掉已還款：{signed(b.net)}
                        {b.sent > 0 && ` + 已付出 ${fm(b.sent)}`}
                        {b.received > 0 && ` − 已收到 ${fm(b.received)}`} = {signed(b.net + b.sent - b.received)}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {/* ── 3. 誰轉給誰 ── */}
            <h2 className="f-h">
              <span className="f-step">3</span>轉帳怎麼來的
            </h2>
            <section className="card f-card">
              {isPool && trip.custodianId && (
                <>
                  <div className="f-method">公費餘額</div>
                  <div className="f-formula num">
                    投入 {fm(summary.totalContributed)} − 公費支出 {fm(summary.totalContributed - summary.poolBalance)} = {fm(summary.poolBalance)}
                  </div>
                  <p className="f-note">
                    公費餘額在保管人 {name(trip.custodianId)} 手上，那是大家的錢，所以他的部位要扣掉：
                    {signed(summary.positions[trip.custodianId] + summary.poolBalance)}
                    {' − '}
                    {fm(summary.poolBalance)} = {signed(summary.positions[trip.custodianId])}
                  </p>
                </>
              )}

              {summary.roundedPositions && (
                <>
                  <div className="f-method">取整數元（方便轉帳）</div>
                  <p className="f-note" style={{ marginTop: 0 }}>
                    先全部無條件捨去到元，總和少掉的幾元補給「被捨去最多」的人，讓大家加起來剛好是 0。每人和精確值相差不到 1 元。
                  </p>
                  <ul className="f-rows">
                    {order.map((id) => (
                      <li key={id}>
                        <span className="who">
                          <Avatar name={name(id)} index={idx(id)} small />
                          {name(id)}
                        </span>
                        <span className="f-detail num">{signed(summary.positions[id])} →</span>
                        <span className="num f-val">{signed(summary.roundedPositions![id])}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="f-method">{isPool ? '保管人多退少補' : '最少轉帳次數（貪婪法）'}</div>
              {isPool ? (
                <p className="f-note" style={{ marginTop: 0 }}>
                  每個人的部位是正的 → 保管人退給他；是負的 → 他補給保管人。
                </p>
              ) : (
                <p className="f-note" style={{ marginTop: 0 }}>
                  每一步都讓「最多要收錢的人」和「最多要付錢的人」配對，轉兩者中較小的金額，直到大家都歸零。
                </p>
              )}
              {summary.transfers.length === 0 ? (
                <p className="f-formula">大家都已經結清，不需要轉帳。</p>
              ) : isPool ? (
                <ol className="f-steps">
                  {summary.transfers.map((t, i) => (
                    <li key={i} className="num">
                      {name(t.fromId)} → {name(t.toId)}　<b>{fm(t.amount)}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <ol className="f-steps">
                  {summary.steps.map((s, i) => (
                    <li key={i}>
                      最多要收：{name(s.creditorId)}（還差 {fm(s.creditorLeft)}）；最多要付：{name(s.debtorId)}（還欠 {fm(s.debtorLeft)}）
                      <div className="num f-step-result">
                        → {name(s.debtorId)} 轉給 {name(s.creditorId)} <b>{fm(s.amount)}</b>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

function Breakdown({ label, items, total }: { label: string; items: { title: string; value: Money }[]; total: Money }) {
  return (
    <div className="f-break">
      <div className="f-break-head">
        <span>{label}</span>
        <span className="num">{fm(total)}</span>
      </div>
      {items.length === 0 ? (
        <div className="f-break-item faint">無</div>
      ) : (
        items.map((it, i) => (
          <div key={i} className="f-break-item">
            <span>{it.title}</span>
            <span className="num">{fm(it.value)}</span>
          </div>
        ))
      )}
      {items.length > 1 && (
        <div className="f-break-sum num">
          {items.map((it) => formatMoney(it.value)).join(' + ')} = {formatMoney(sum(items.map((it) => it.value)))}
        </div>
      )}
    </div>
  );
}
