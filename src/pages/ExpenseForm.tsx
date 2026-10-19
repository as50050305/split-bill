import { useMemo, useState } from 'react';
import { CATEGORIES, categoryOf } from '../core/categories';
import { formatMoney, sum } from '../core/money';
import { splitExpense } from '../core/split';
import type { CategoryId, Expense, SplitSpec, TripMember } from '../core/types';
import { validateExpense } from '../core/validate';
import type { ExpenseError } from '../core/validate';
import { AppBar, Avatar, Check, ConfirmSheet, MoneyInput, useToast } from '../components/ui';
import { goBack } from '../router';
import { deleteExpense, upsertExpense } from '../store/actions';
import { useStore } from '../store/AppStore';
import { cx, newId, today } from '../utils';
import { NotFound } from './TripForm';

type SplitType = SplitSpec['type'];

export function ExpenseForm({ tripId, expenseId }: { tripId: string; expenseId?: string }) {
  const { data, update } = useStore();
  const toast = useToast();
  const trip = data.trips.find((t) => t.id === tripId);
  const existing = expenseId ? data.expenses.find((e) => e.id === expenseId) : undefined;
  if (!trip || (expenseId && !existing)) return <NotFound />;
  return <ExpenseFormInner key={expenseId ?? 'new'} trip={trip} existing={existing} onSave={(e) => {
    update((d) => upsertExpense(d, e));
    toast(existing ? '已更新支出' : '已新增支出');
    goBack();
  }} onDelete={existing ? () => {
    update((d) => deleteExpense(d, existing.id));
    toast('已刪除支出');
    goBack();
  } : undefined} lastPayerId={[...data.expenses].reverse().find((e) => e.tripId === tripId && e.payerId)?.payerId} />;
}

function ExpenseFormInner({
  trip,
  existing,
  onSave,
  onDelete,
  lastPayerId,
}: {
  trip: { id: string; mode: 'pool' | 'individual'; members: TripMember[]; custodianId?: string };
  existing?: Expense;
  onSave: (e: Expense) => void;
  onDelete?: () => void;
  lastPayerId?: string;
}) {
  const members = trip.members;
  const order = members.map((m) => m.id);
  const s = existing?.split;

  const [amount, setAmount] = useState<number | null>(existing?.amount ?? null);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [categoryId, setCategoryId] = useState<CategoryId>(existing?.categoryId ?? 'food');
  const [date, setDate] = useState(existing?.date ?? today());
  const [payerId, setPayerId] = useState<string | undefined>(
    existing ? existing.payerId : trip.mode === 'individual' ? (lastPayerId && order.includes(lastPayerId) ? lastPayerId : order[0]) : undefined,
  );
  const [splitType, setSplitType] = useState<SplitType>(s?.type ?? 'equal');
  const [included, setIncluded] = useState<Set<string>>(() => {
    if (!s) return new Set(order);
    if (s.type === 'equal') return new Set(s.participants);
    if (s.type === 'shares') return new Set(Object.keys(s.shares).filter((k) => s.shares[k] > 0));
    return new Set(Object.keys(s.amounts).filter((k) => s.amounts[k] > 0));
  });
  const [shares, setShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.map((id) => [id, s?.type === 'shares' && s.shares[id] ? String(s.shares[id]) : '1'])),
  );
  const [exact, setExact] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(order.map((id) => [id, s?.type === 'exact' ? (s.amounts[id] ?? null) : null])),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [touched, setTouched] = useState(false);

  const spec: SplitSpec = useMemo(() => {
    const inc = order.filter((id) => included.has(id));
    if (splitType === 'equal') return { type: 'equal', participants: inc };
    if (splitType === 'shares') {
      return { type: 'shares', shares: Object.fromEntries(inc.map((id) => [id, Number(shares[id]) || 0])) };
    }
    return { type: 'exact', amounts: Object.fromEntries(inc.map((id) => [id, exact[id] ?? 0])) };
  }, [order, included, splitType, shares, exact]);

  const finalTitle = title.trim() || categoryOf(categoryId).label;
  const draft = { title: finalTitle, amount: amount ?? 0, categoryId, date, payerId, split: spec };
  const errors = validateExpense(draft, trip);
  const preview: Record<string, number> = useMemo(() => {
    try {
      return amount ? splitExpense(amount, spec, order) : {};
    } catch {
      return {};
    }
  }, [amount, spec, order]);

  const exactSum = sum(order.filter((id) => included.has(id)).map((id) => exact[id] ?? 0));
  const exactDiff = (amount ?? 0) - exactSum;

  const toggle = (id: string) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOn = included.size === members.length;
  const setAll = () => setIncluded(allOn ? new Set() : new Set(order));

  const stepShare = (id: string, delta: number) => {
    const cur = Number(shares[id]) || 0;
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
    setShares((s) => ({ ...s, [id]: String(next) }));
    if (next > 0 && !included.has(id)) toggle(id);
  };

  /** 指定金額：把差額一次補給某人 */
  const fillRemainder = (id: string) => {
    if (exactDiff === 0) return;
    const next = Math.max(0, (exact[id] ?? 0) + exactDiff);
    setExact((e) => ({ ...e, [id]: next }));
    if (!included.has(id)) toggle(id);
  };

  const save = () => {
    setTouched(true);
    if (errors.length) return;
    onSave({
      id: existing?.id ?? newId(),
      tripId: trip.id,
      title: finalTitle,
      amount: amount!,
      categoryId,
      date,
      payerId,
      split: spec,
      note: existing?.note,
      createdAt: existing?.createdAt ?? Date.now(),
    });
  };

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  return (
    <>
      <AppBar
        title={existing ? '編輯支出' : '新增支出'}
        back
        actions={
          onDelete && (
            <button className="icon-btn" aria-label="刪除" onClick={() => setConfirmDelete(true)}>
              🗑️
            </button>
          )
        }
      />
      <main className="page">
        <div className="stack">
          <MoneyInput value={amount} onChange={setAmount} size="big" autoFocus={!existing} ariaLabel="金額" invalid={touched && !amount} />

          <input
            className="input"
            value={title}
            maxLength={40}
            placeholder={`項目名稱（空白則用「${categoryOf(categoryId).label}」）`}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={cx('cat-btn', categoryId === c.id && 'on')} onClick={() => setCategoryId(c.id)}>
                <span className="ico">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>

          <div className="field">
            <span className="field-label">{trip.mode === 'pool' ? '誰付的' : '付款人'}</span>
            <div className="chips">
              {trip.mode === 'pool' && (
                <button className={payerId === undefined ? 'chip on' : 'chip'} onClick={() => setPayerId(undefined)}>
                  💰 公費
                </button>
              )}
              {members.map((m) => (
                <button key={m.id} className={payerId === m.id ? 'chip on' : 'chip'} onClick={() => setPayerId(m.id)}>
                  {m.name}
                  {trip.mode === 'pool' && payerId === m.id && ' 代墊'}
                </button>
              ))}
            </div>
            {trip.mode === 'pool' && payerId && (
              <p className="faint" style={{ fontSize: 13, paddingLeft: 4 }}>
                {nameOf(payerId)} 自掏腰包代墊，結算時會算成他多投入了這筆公費
              </p>
            )}
          </div>

          <div className="field">
            <span className="field-label">分攤方式</span>
            <div className="seg">
              {(
                [
                  ['equal', '平均'],
                  ['shares', '指定份數'],
                  ['exact', '指定金額'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} className={splitType === k ? 'active' : ''} onClick={() => setSplitType(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="list">
            <button className="split-row" style={{ width: '100%', background: 'var(--surface-2)', border: 0, minHeight: 52 }} onClick={setAll}>
              <span className="who" style={{ fontSize: 15, padding: 0 }}>
                <Check on={allOn} />
                <span>{allOn ? '全部人分攤' : `${included.size} / ${members.length} 人分攤`}</span>
              </span>
              <span className="muted" style={{ fontSize: 14 }}>
                {allOn ? '點成員可排除' : '點這裡全選'}
              </span>
            </button>
            {members.map((m, i) => {
              const on = included.has(m.id);
              return (
                <div key={m.id} className={cx('split-row', !on && 'off')}>
                  <button className="who" onClick={() => toggle(m.id)}>
                    <Check on={on} />
                    {splitType === 'equal' && <Avatar name={m.name} index={i} />}
                    <span>{m.name}</span>
                  </button>
                  {splitType === 'shares' && on && (
                    <div className="stepper">
                      <button aria-label="減少份數" onClick={() => stepShare(m.id, -0.5)}>
                        −
                      </button>
                      <input
                        inputMode="decimal"
                        value={shares[m.id]}
                        aria-label={`${m.name} 份數`}
                        onChange={(e) => setShares((s) => ({ ...s, [m.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                        onFocus={(e) => e.target.select()}
                      />
                      <button aria-label="增加份數" onClick={() => stepShare(m.id, 0.5)}>
                        ＋
                      </button>
                    </div>
                  )}
                  {splitType === 'exact' && on && (
                    <div style={{ width: 140 }}>
                      <MoneyInput
                        size="sm"
                        value={exact[m.id]}
                        ariaLabel={`${m.name} 金額`}
                        onChange={(v) => setExact((e) => ({ ...e, [m.id]: v }))}
                      />
                    </div>
                  )}
                  {splitType !== 'exact' && (
                    <span className={cx('split-amount', !on && 'faint')}>{on && preview[m.id] !== undefined ? formatMoney(preview[m.id]) : '—'}</span>
                  )}
                </div>
              );
            })}
            {splitType === 'exact' ? (
              <div className={cx('split-footer', exactDiff !== 0 && 'bad')}>
                <span>
                  已分配 {formatMoney(exactSum)} / {formatMoney(amount ?? 0)}
                </span>
                <span>{exactDiff === 0 ? '✓ 剛好' : exactDiff > 0 ? `還差 ${formatMoney(exactDiff)}` : `超出 ${formatMoney(-exactDiff)}`}</span>
              </div>
            ) : (
              <div className="split-footer">
                <span className="muted">合計</span>
                <span className="num">{formatMoney(sum(Object.values(preview)))}</span>
              </div>
            )}
          </div>
          {splitType === 'exact' && exactDiff > 0 && included.size > 0 && (
            <div className="chips">
              <span className="muted" style={{ fontSize: 14, alignSelf: 'center' }}>差額補給：</span>
              {order
                .filter((id) => included.has(id))
                .map((id) => (
                  <button key={id} className="chip dashed" style={{ minHeight: 40 }} onClick={() => fillRemainder(id)}>
                    {nameOf(id)}
                  </button>
                ))}
            </div>
          )}
          {splitType !== 'equal' && (
            <p className="faint" style={{ fontSize: 13, paddingLeft: 4 }}>
              {splitType === 'shares'
                ? '份數可輸入小數（例如 0.5），除不盡的零頭給小數部分最大的人'
                : '每個人的金額加起來必須剛好等於支出金額才能存檔'}
            </p>
          )}

          <div className="field">
            <label htmlFor="date">日期</label>
            <input id="date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </main>

      <div className="sticky-actions">
        {errors.length > 0 && (touched || errors[0].field === 'split') && amount ? (
          <p className="hint neg">{errorText(errors[0])}</p>
        ) : null}
        <button className="btn primary block lg" disabled={touched && errors.length > 0} onClick={save}>
          {existing ? '儲存變更' : '新增支出'}
        </button>
      </div>

      {confirmDelete && onDelete && (
        <ConfirmSheet
          title="刪除這筆支出？"
          body={`${finalTitle} NT$ ${formatMoney(amount ?? 0)}`}
          confirmLabel="刪除"
          danger
          onConfirm={onDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

function errorText(e: ExpenseError): string {
  switch (e.field) {
    case 'title':
      return '請輸入項目名稱';
    case 'amount':
      return '請輸入金額（整數元）';
    case 'date':
      return '請選擇日期';
    case 'payer':
      return '請選擇付款人';
    case 'split': {
      const d = e.detail;
      if (d.reason === 'exactMismatch') return d.diff > 0 ? `指定金額還差 ${formatMoney(d.diff)} 元` : `指定金額超出 ${formatMoney(-d.diff)} 元`;
      if (d.reason === 'noParticipants') return '至少要有一個人分攤';
      if (d.reason === 'invalidShare') return '份數只能是 0 以上、最多兩位小數';
      return '分攤設定有誤';
    }
  }
}
