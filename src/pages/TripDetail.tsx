import { useMemo, useState } from 'react';
import { computeTripSummary } from '../core/balance';
import type { TripSummary } from '../core/balance';
import { categoryOf } from '../core/categories';
import { formatMoney, sum } from '../core/money';
import type { Contribution, Expense, Payment, Transfer, Trip } from '../core/types';
import { Icon } from '../components/icons';
import { AppBar, Avatar, Check, ConfirmSheet, Empty, Fab, Money, Pill, Sheet, Sq, useToast } from '../components/ui';
import { navigate } from '../router';
import { drawSettlementImage } from '../share/settlementImage';
import { shareImage } from '../share/shareImage';
import { addContributions, addPayment, deleteContribution, deleteExpense, deletePayment, tripLedger, upsertExpense, upsertTrip } from '../store/actions';
import { useStore } from '../store/AppStore';
import { formatDate, newId, today } from '../utils';
import { NotFound } from './TripForm';

type Tab = 'expenses' | 'pool' | 'settle';

export function TripDetail({ tripId, tab }: { tripId: string; tab: Tab }) {
  const { data } = useStore();
  const trip = data.trips.find((t) => t.id === tripId);
  const ledger = useMemo(() => tripLedger(data, tripId), [data, tripId]);
  const summary = useMemo(() => {
    if (!trip) return null;
    try {
      return computeTripSummary({ trip, ...ledger });
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [trip, ledger]);

  if (!trip) return <NotFound />;
  const activeTab: Tab = tab === 'pool' && trip.mode !== 'pool' ? 'expenses' : tab;
  const go = (t: Tab) => navigate({ name: 'trip', tripId, tab: t }, { replace: true });
  const tabs: [Tab, string][] =
    trip.mode === 'pool'
      ? [
          ['expenses', '支出'],
          ['pool', '公費'],
          ['settle', '結算'],
        ]
      : [
          ['expenses', '支出'],
          ['settle', '結算'],
        ];

  return (
    <>
      <AppBar
        title={trip.name}
        eyebrow={trip.mode === 'pool' ? 'Pool · 公費制' : 'Split · 各自付款'}
        back={{ name: 'trips' }}
        actions={
          <Sq icon="sliders" label="編輯旅程" tone="ink" onClick={() => navigate({ name: 'tripEdit', tripId })} />
        }
      >
        <div className="tabs">
          {tabs.map(([k, label]) => (
            <button key={k} className={activeTab === k ? 'tab active' : 'tab'} onClick={() => go(k)}>
              {label}
            </button>
          ))}
        </div>
      </AppBar>
      <main className="page with-tabs">
        {!summary ? (
          <Empty icon="receipt" tone="rose" title="資料有誤，無法計算" hint="請檢查最近修改的支出" />
        ) : activeTab === 'expenses' ? (
          <ExpensesTab trip={trip} expenses={ledger.expenses} summary={summary} />
        ) : activeTab === 'pool' ? (
          <PoolTab trip={trip} contributions={ledger.contributions} summary={summary} />
        ) : (
          <SettleTab trip={trip} summary={summary} payments={ledger.payments} expenses={ledger.expenses} />
        )}
      </main>
      {activeTab === 'expenses' && <Fab noNav label="記一筆" onClick={() => navigate({ name: 'expenseNew', tripId })} />}
      {activeTab === 'pool' && <Fab noNav label="投入公費" icon="coins" tone="clay" onClick={() => navigate({ name: 'contributionNew', tripId })} />}
    </>
  );
}

// ── 支出 ──────────────────────────────────
function ExpensesTab({ trip, expenses, summary }: { trip: Trip; expenses: Expense[]; summary: TripSummary }) {
  const { update } = useStore();
  const toast = useToast();
  const [menuFor, setMenuFor] = useState<Expense | null>(null);
  const [confirmDel, setConfirmDel] = useState<Expense | null>(null);
  const removeExpense = (e: Expense) => {
    update((d) => deleteExpense(d, e.id));
    toast(`已刪除「${e.title}」`, { label: '復原', onClick: () => update((d) => upsertExpense(d, e)) });
  };
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? '?';
  const byDate = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const groups: { date: string; items: Expense[] }[] = [];
    for (const e of sorted) {
      const g = groups[groups.length - 1];
      if (g && g.date === e.date) g.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    }
    return groups;
  }, [expenses]);

  const splitLabel = (e: Expense) => {
    const s = e.split;
    const n = s.type === 'equal' ? s.participants.length : Object.values(s.type === 'shares' ? s.shares : s.amounts).filter((v) => v > 0).length;
    const how = s.type === 'equal' ? '平分' : s.type === 'shares' ? '按份數' : '指定金額';
    const all = n === trip.members.length;
    return `${all ? '全員' : `${n} 人`}${how}`;
  };
  const payerLabel = (e: Expense) => {
    const ids = trip.members.map((m) => m.id).filter((id) => (e.payers?.[id] ?? 0) > 0);
    const who = ids.map(name).join('、');
    if (e.kind === 'subsidy') return `補貼給 ${who}`;
    if (trip.mode === 'pool') return ids.length ? `${who} 代墊` : '公費';
    return ids.length > 1 ? `${who} 合付` : `${who} 付`;
  };

  return (
    <>
      <div className="hero">
        {trip.mode === 'pool' ? (
          <>
            <div className="label">公費餘額</div>
            <div className="value">
              <small>NT$</small>
              {formatMoney(summary.poolBalance)}
            </div>
            <div className="hero-grid">
              <div>
                <div className="label">總支出</div>
                <div className="value">{formatMoney(summary.totalExpense)}</div>
              </div>
              <div>
                <div className="label">已投入</div>
                <div className="value">{formatMoney(summary.totalContributed)}</div>
              </div>
            </div>
            {summary.poolBalance < 0 && (
              <p className="warn">公費不夠了。請到「公費」分頁投入，或把支出標成某人代墊。</p>
            )}
          </>
        ) : (
          <>
            <div className="label">總支出</div>
            <div className="value">
              <small>NT$</small>
              {formatMoney(summary.totalExpense)}
            </div>
            <div className="hero-grid">
              <div>
                <div className="label">筆數</div>
                <div className="value">{expenses.length}</div>
              </div>
              <div>
                <div className="label">人均</div>
                <div className="value">{formatMoney(Math.round(summary.totalExpense / trip.members.length))}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {byDate.length === 0 ? (
        <Empty icon="receipt" tone="clay" title="還沒有支出" hint="按右下角「記一筆」新增" />
      ) : (
        byDate.map((g) => (
          <section key={g.date}>
            <div className="section-title">
              <span>{formatDate(g.date)}</span>
              <span className="num">{formatMoney(sum(g.items.map((e) => e.amount)))}</span>
            </div>
            <div className="list">
              {g.items.map((e) => (
                <div key={e.id} className="row-wrap">
                  <button className="row" onClick={() => navigate({ name: 'expenseEdit', tripId: trip.id, expenseId: e.id })}>
                    <span className={`tile tone-${categoryOf(e.categoryId).tone}`}>
                      <Icon name={e.categoryId} />
                    </span>
                    <div className="grow">
                      <div className="title">{e.title}</div>
                      <div className="sub">
                        {payerLabel(e)} · {splitLabel(e)}
                      </div>
                    </div>
                    <span className="amount">{formatMoney(e.amount)}</span>
                  </button>
                  <Sq icon="more" label={`${e.title} 更多動作`} flat small onClick={() => setMenuFor(e)} />
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)}>
          <h2>{menuFor.title}</h2>
          <p className="body num" style={{ marginBottom: 12 }}>
            NT$ {formatMoney(menuFor.amount)} · {payerLabel(menuFor)}
          </p>
          <div className="stack" style={{ gap: 8 }}>
            <button
              className="menu-item"
              onClick={() => {
                const id = menuFor.id;
                setMenuFor(null);
                navigate({ name: 'expenseEdit', tripId: trip.id, expenseId: id });
              }}
            >
              <span className="tile tone-blue" style={{ width: 40, height: 40 }}>
                <Icon name="edit" size={20} />
              </span>
              編輯（改付款人、金額、分攤）
            </button>
            <button
              className="menu-item"
              onClick={() => {
                setConfirmDel(menuFor);
                setMenuFor(null);
              }}
            >
              <span className="tile tone-rose" style={{ width: 40, height: 40 }}>
                <Icon name="trash" size={20} />
              </span>
              刪除這筆
            </button>
          </div>
        </Sheet>
      )}
      {confirmDel && (
        <ConfirmSheet
          title={`刪除「${confirmDel.title}」？`}
          body={`NT$ ${formatMoney(confirmDel.amount)}，刪除後結算會重新計算。刪錯了可以按「復原」。`}
          confirmLabel="刪除"
          danger
          onConfirm={() => removeExpense(confirmDel)}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </>
  );
}

// ── 公費 ──────────────────────────────────
function PoolTab({ trip, contributions, summary }: { trip: Trip; contributions: Contribution[]; summary: TripSummary }) {
  const { update } = useStore();
  const toast = useToast();
  const [deleting, setDeleting] = useState<Contribution | null>(null);
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? '?';
  const sorted = [...contributions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  return (
    <>
      <div className="hero">
        <div className="label">公費餘額 · 在 {trip.custodianId ? name(trip.custodianId) : '保管人'} 手上</div>
        <div className="value">
          <small>NT$</small>
          {formatMoney(summary.poolBalance)}
        </div>
        <div className="hero-grid">
          <div>
            <div className="label">已投入</div>
            <div className="value">{formatMoney(summary.totalContributed)}</div>
          </div>
          <div>
            <div className="label">公費支出</div>
            <div className="value">{formatMoney(summary.totalContributed - summary.poolBalance)}</div>
          </div>
        </div>
      </div>

      <div className="section-title">每人投入</div>
      <div className="list">
        {summary.balances.map((b, i) => (
          <div className="row" key={b.memberId}>
            <Avatar name={name(b.memberId)} index={i} />
            <div className="grow">
              <div className="title">
                {name(b.memberId)}
                {b.memberId === trip.custodianId && <span className="badge" style={{ marginLeft: 8 }}>保管人</span>}
              </div>
              {b.advanced > 0 && <div className="sub">另代墊 {formatMoney(b.advanced)}</div>}
            </div>
            <span className="amount">{formatMoney(b.contributed)}</span>
          </div>
        ))}
      </div>

      <div className="section-title">投入紀錄</div>
      {sorted.length === 0 ? (
        <div className="empty" style={{ padding: 24 }}>
          還沒有投入紀錄
        </div>
      ) : (
        <div className="list">
          {sorted.map((c) => (
            <div className="row" key={c.id}>
              <div className="grow">
                <div className="title">{name(c.memberId)} 投入</div>
                <div className="sub">{formatDate(c.date)}</div>
              </div>
              <span className="amount">{formatMoney(c.amount)}</span>
              <Sq icon="trash" label="刪除" small onClick={() => setDeleting(c)} />
            </div>
          ))}
        </div>
      )}
      {deleting && (
        <ConfirmSheet
          title="刪除這筆投入？"
          body={`${name(deleting.memberId)} 投入 NT$ ${formatMoney(deleting.amount)}`}
          confirmLabel="刪除"
          danger
          onConfirm={() => {
            const c = deleting;
            update((d) => deleteContribution(d, c.id));
            toast(`已刪除 ${name(c.memberId)} 的投入`, { label: '復原', onClick: () => update((d) => addContributions(d, [c])) });
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

// ── 結算 ──────────────────────────────────
function SettleTab({ trip, summary, payments, expenses }: { trip: Trip; summary: TripSummary; payments: Payment[]; expenses: Expense[] }) {
  const { update } = useStore();
  const toast = useToast();
  const [image, setImage] = useState<string | null>(null);
  const [undo, setUndo] = useState<Payment | null>(null);
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? '?';
  const idx = (id: string) => trip.members.findIndex((m) => m.id === id);
  const isPool = trip.mode === 'pool';
  const rounding = trip.rounding ?? 'yuan';
  const setRounding = (r: 'yuan' | 'cent') => update((d) => upsertTrip(d, { ...trip, rounding: r }));

  const markPaid = (t: Transfer) => {
    update((d) => addPayment(d, { id: newId(), tripId: trip.id, fromId: t.fromId, toId: t.toId, amount: t.amount, date: today(), createdAt: Date.now() }));
    toast(`已標記 ${name(t.fromId)} → ${name(t.toId)} 還款`);
  };

  const dates = expenses.map((e) => e.date).sort();
  const dateRange = dates.length ? (dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} ~ ${dates[dates.length - 1]}`).replaceAll('-', '/') : undefined;

  const makeImage = async () => {
    try {
      // 等數字字型載入完成再畫，避免圖片用到替代字型
      await document.fonts?.load('800 40px "Manrope Variable"').catch(() => undefined);
      setImage(drawSettlementImage({ trip, summary, payments, dateRange }));
    } catch (e) {
      toast('產生圖片失敗');
      console.error(e);
    }
  };

  const share = async () => {
    if (!image) return;
    try {
      const r = await shareImage(image, `${trip.name} 結算`);
      if (r === 'downloaded') toast('已下載圖片');
    } catch (e) {
      toast('分享失敗');
      console.error(e);
    }
  };

  const custodianRow = isPool ? summary.balances.find((b) => b.memberId === trip.custodianId) : undefined;

  return (
    <>
      <div className="section-title">每人收支</div>
      <div className="list">
        <table className="bal-table">
          <thead>
            <tr>
              <th>成員</th>
              <th>{isPool ? '投入' : '已付'}</th>
              <th>應付</th>
              <th>淨額</th>
            </tr>
          </thead>
          <tbody>
            {summary.balances.map((b) => (
              <tr key={b.memberId}>
                <td>
                  {name(b.memberId)}
                  {isPool && b.memberId === trip.custodianId && <span className="badge" style={{ marginLeft: 6 }}>保管</span>}
                </td>
                <td>{formatMoney(b.paid)}</td>
                <td>{formatMoney(b.owed)}</td>
                <td>
                  <Money value={b.net} signed />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        淨額＝{isPool ? '投入（含代墊）' : '已付'} − 應付。正數代表該拿回錢，負數代表要再付錢。
      </p>

      <div className="section-title">轉帳清單{isPool && '（都透過保管人）'}</div>
      <div className="seg" style={{ marginBottom: 10 }}>
        {(
          [
            ['yuan', '取整數元'],
            ['cent', '到小數 2 位'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={rounding === k ? 'active' : ''} onClick={() => setRounding(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="list">
        {summary.transfers.length === 0 && payments.length === 0 && (
          <div className="all-clear">
            <span className="tile tone-sage">
              <Icon name="sparkle" />
            </span>
            <p>{expenses.length ? '不需要轉帳，大家剛好打平' : '還沒有支出'}</p>
          </div>
        )}
        {summary.transfers.map((t, i) => (
          <button key={`t${i}`} className="transfer" onClick={() => markPaid(t)}>
            <Check on={false} />
            <span className="flow">
              <Avatar name={name(t.fromId)} index={idx(t.fromId)} small />
              {name(t.fromId)}
              <span className="arrow">
                <Icon name="arrowRight" size={18} />
              </span>
              <Avatar name={name(t.toId)} index={idx(t.toId)} small />
              {name(t.toId)}
            </span>
            <span className="amount">{formatMoney(t.amount)}</span>
          </button>
        ))}
        {payments.map((p) => (
          <button key={p.id} className="transfer done" onClick={() => setUndo(p)}>
            <Check on />
            <span className="flow">
              {name(p.fromId)}
              <span className="arrow">
                <Icon name="arrowRight" size={18} />
              </span>
              {name(p.toId)}
            </span>
            <span className="amount">{formatMoney(p.amount)}</span>
          </button>
        ))}
      </div>
      {summary.transfers.length > 0 && (
        <p className="note">
          還完錢後點一下該筆，標記為「已還款」。
          {rounding === 'yuan' && '金額已取整數元，每人和精確值相差不到 1 元。'}
        </p>
      )}
      {isPool && custodianRow && trip.custodianId && (
        <p className="note">
          公費餘額 NT$ {formatMoney(summary.poolBalance)} 在保管人 {name(trip.custodianId)} 手上
          {custodianRow.net > 0 && `，其中 ${formatMoney(custodianRow.net)} 是他自己的，不用轉帳`}。
        </p>
      )}

      <div className="stack" style={{ marginTop: 24 }}>
        <Pill block light label="查看計算公式" icon="receipt" tone="mustard" disabled={expenses.length === 0} onClick={() => navigate({ name: 'formula', tripId: trip.id })} />
        <Pill block label="產生結算圖片" icon="image" tone="blue" disabled={expenses.length === 0} onClick={makeImage} />
      </div>

      {image && (
        <Sheet onClose={() => setImage(null)}>
          <h2>結算圖片</h2>
          <img className="preview-img" src={image} alt="結算圖片預覽" style={{ marginTop: 12 }} />
          <div className="btn-row">
            <button className="btn ghost lg" style={{ flex: '0 0 96px' }} onClick={() => setImage(null)}>
              關閉
            </button>
            <Pill label="分享到 LINE" icon="share" tone="blue" onClick={share} />
          </div>
        </Sheet>
      )}
      {undo && (
        <ConfirmSheet
          title="取消這筆還款標記？"
          body={`${name(undo.fromId)} → ${name(undo.toId)} NT$ ${formatMoney(undo.amount)}`}
          confirmLabel="取消標記"
          danger
          onConfirm={() => update((d) => deletePayment(d, undo.id))}
          onClose={() => setUndo(null)}
        />
      )}
    </>
  );
}
