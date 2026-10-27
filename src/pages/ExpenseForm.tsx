import { useMemo, useState } from 'react';
import { CATEGORIES, categoryOf } from '../core/categories';
import { formatMoney, sum } from '../core/money';
import { splitEqual, splitExpense } from '../core/split';
import type { CategoryId, Expense, ExpenseKind, SplitSpec, TripMember } from '../core/types';
import { validateExpense } from '../core/validate';
import type { ExpenseError } from '../core/validate';
import { Icon } from '../components/icons';
import { AppBar, Avatar, Check, ConfirmSheet, MoneyInput, Pill, Sq, useToast } from '../components/ui';
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
    const snapshot = existing;
    update((d) => deleteExpense(d, snapshot.id));
    toast(`已刪除「${snapshot.title}」`, { label: '復原', onClick: () => update((d) => upsertExpense(d, snapshot)) });
    goBack();
  } : undefined} lastPayerId={Object.keys([...data.expenses].reverse().find((e) => e.tripId === tripId && Object.keys(e.payers ?? {}).length)?.payers ?? {})[0]} />;
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
  const [kind, setKind] = useState<ExpenseKind>(existing?.kind ?? 'expense');
  // 付款人（補貼時＝收補貼的人），可多選；公費制不選＝公費支出
  const [payerSel, setPayerSel] = useState<string[]>(() => {
    if (existing) return order.filter((id) => (existing.payers?.[id] ?? 0) > 0);
    if (trip.mode === 'pool') return [];
    return [lastPayerId && order.includes(lastPayerId) ? lastPayerId : order[0]];
  });
  // 新增時預設帶入上一次的付款人；第一次點別人是「換人」，之後才是多選
  const [payerAuto, setPayerAuto] = useState(!existing && trip.mode === 'individual');
  const [payerAmt, setPayerAmt] = useState<Record<string, number | null>>(() => ({ ...(existing?.payers ?? {}) }));
  // 多人付款時，使用者沒改過金額就自動平均分配
  const [payerEdited, setPayerEdited] = useState<boolean>(() => {
    if (!existing) return false;
    const sel = order.filter((id) => (existing.payers?.[id] ?? 0) > 0);
    if (sel.length < 2) return false;
    const even = splitEqual(existing.amount, sel);
    return sel.some((id) => even[id] !== existing.payers[id]);
  });
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

  const payerAmounts: Record<string, number | null> = useMemo(() => {
    if (payerSel.length === 0) return {};
    if (payerSel.length === 1) return { [payerSel[0]]: amount ?? 0 };
    if (!payerEdited) return amount ? splitEqual(amount, payerSel) : Object.fromEntries(payerSel.map((id) => [id, null]));
    return Object.fromEntries(payerSel.map((id) => [id, payerAmt[id] ?? null]));
  }, [payerSel, payerEdited, payerAmt, amount]);
  const payers: Record<string, number> = Object.fromEntries(payerSel.map((id) => [id, payerAmounts[id] ?? 0]));
  const payerSum = sum(Object.values(payers));
  const payerDiff = (amount ?? 0) - payerSum;

  const togglePayer = (id: string) => {
    setPayerEdited(false);
    if (payerAuto) {
      setPayerAuto(false);
      setPayerSel([id]);
      return;
    }
    setPayerSel((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : order.filter((x) => x === id || sel.includes(x))));
  };
  const editPayerAmount = (id: string, v: number | null) => {
    setPayerAmt({ ...payerAmounts, [id]: v });
    setPayerEdited(true);
  };
  const chooseKind = (k: ExpenseKind) => {
    setKind(k);
    // 補貼要明確選人，不沿用預設付款人
    if (k === 'subsidy' && payerAuto) {
      setPayerSel([]);
      setPayerAuto(false);
    }
    if (k === 'subsidy' && !existing && categoryId === 'food') setCategoryId('transport');
  };

  const isSubsidy = kind === 'subsidy';
  const finalTitle = title.trim() || (isSubsidy ? `${categoryOf(categoryId).label}補貼` : categoryOf(categoryId).label);
  const draft = { title: finalTitle, amount: amount ?? 0, categoryId, date, payers, kind, split: spec };
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
      payers,
      kind,
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
          onDelete && <Sq icon="trash" label="刪除" tone="rose" onClick={() => setConfirmDelete(true)} />
        }
      />
      <main className="page">
        <div className="stack">
          <MoneyInput value={amount} onChange={setAmount} size="big" autoFocus={!existing} ariaLabel="金額" invalid={touched && !amount} />

          <input
            className="input"
            value={title}
            maxLength={40}
            placeholder={`項目名稱（空白則用「${isSubsidy ? `${categoryOf(categoryId).label}補貼` : categoryOf(categoryId).label}」）`}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={cx('cat-btn', categoryId === c.id && 'on')} onClick={() => setCategoryId(c.id)}>
                <span className={`tile tone-${c.tone}`}>
                  <Icon name={c.id} size={20} />
                </span>
                {c.label}
              </button>
            ))}
          </div>

          <div className="field">
            <span className="field-label">類型</span>
            <div className="seg">
              <button className={!isSubsidy ? 'active' : ''} onClick={() => chooseKind('expense')}>
                一般支出
              </button>
              <button className={isSubsidy ? 'active' : ''} onClick={() => chooseKind('subsidy')}>
                補貼（油錢等）
              </button>
            </div>
          </div>

          <div className="field">
            <span className="field-label">
              {isSubsidy ? '補貼給誰（可多選）' : trip.mode === 'pool' ? '誰付的（可多人代墊）' : '付款人（可多選）'}
            </span>
            <div className="chips">
              {trip.mode === 'pool' && !isSubsidy && (
                <button
                  className={payerSel.length === 0 ? 'chip on' : 'chip'}
                  onClick={() => {
                    setPayerSel([]);
                    setPayerEdited(false);
                    setPayerAuto(false);
                  }}
                >
                  <Icon name="wallet" size={18} /> 公費
                </button>
              )}
              {members.map((m) => {
                const on = payerSel.includes(m.id);
                return (
                  <button key={m.id} className={on ? 'chip on' : 'chip'} onClick={() => togglePayer(m.id)}>
                    {on && <Icon name="check" size={16} />}
                    {m.name}
                  </button>
                );
              })}
            </div>
            {payerSel.length > 1 && (
              <div className="list" style={{ marginTop: 4 }}>
                {payerSel.map((id) => (
                  <div key={id} className="split-row">
                    <span className="who" style={{ padding: 0 }}>
                      <Avatar name={nameOf(id)} index={order.indexOf(id)} small />
                      <span>{nameOf(id)}</span>
                    </span>
                    <div style={{ width: 140 }}>
                      <MoneyInput size="sm" value={payerAmounts[id] ?? null} ariaLabel={`${nameOf(id)} 出的金額`} onChange={(v) => editPayerAmount(id, v)} />
                    </div>
                  </div>
                ))}
                <div className={cx('split-footer', payerDiff !== 0 && !!amount && 'bad')}>
                  <span>
                    {isSubsidy ? '已分配' : '已出'} {formatMoney(payerSum)} / {formatMoney(amount ?? 0)}
                  </span>
                  {payerEdited ? (
                    <button className="link-btn" style={{ padding: 0, background: 'none', border: 0, fontWeight: 700, color: 'inherit', textDecoration: 'underline' }} onClick={() => setPayerEdited(false)}>
                      改回平均
                    </button>
                  ) : (
                    <span className="muted">自動平均，可直接修改</span>
                  )}
                </div>
              </div>
            )}
            {isSubsidy ? (
              <p className="faint" style={{ fontSize: 13, paddingLeft: 4 }}>
                補貼不是實際付款：結算時收補貼的人會拿到這筆錢，由下方分攤的人出。開車的人如果不用出，在分攤裡把他點掉。
              </p>
            ) : (
              trip.mode === 'pool' &&
              payerSel.length > 0 && (
                <p className="faint" style={{ fontSize: 13, paddingLeft: 4 }}>
                  {payerSel.map(nameOf).join('、')} 自掏腰包代墊，結算時會算成多投入了這筆公費
                </p>
              )
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
            <button className="split-row head" onClick={setAll}>
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
                        {splitType === 'equal' && <Avatar name={m.name} index={i} small />}
                    <span>{m.name}</span>
                  </button>
                  {splitType === 'shares' && on && (
                    <div className="stepper">
                      <button aria-label="減少份數" onClick={() => stepShare(m.id, -0.5)}>
                        <Icon name="down" size={18} />
                      </button>
                      <input
                        inputMode="decimal"
                        value={shares[m.id]}
                        aria-label={`${m.name} 份數`}
                        onChange={(e) => setShares((s) => ({ ...s, [m.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                        onFocus={(e) => e.target.select()}
                      />
                      <button aria-label="增加份數" onClick={() => stepShare(m.id, 0.5)}>
                        <Icon name="up" size={18} />
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

          {onDelete && (
            <button className="danger-link" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={18} /> 刪除這筆支出
            </button>
          )}
        </div>
      </main>

      <div className="sticky-actions">
        {errors.length > 0 && (touched || errors[0].field === 'split' || (errors[0].field === 'payer' && errors[0].code === 'mismatch')) && amount ? (
          <p className="hint neg">{errorText(errors[0], isSubsidy)}</p>
        ) : null}
        <Pill block label={existing ? '儲存變更' : '新增支出'} icon="check" disabled={touched && errors.length > 0} onClick={save} />
      </div>

      {confirmDelete && onDelete && (
        <ConfirmSheet
          title="刪除這筆支出？"
          body={`${existing?.title ?? finalTitle} NT$ ${formatMoney(existing?.amount ?? amount ?? 0)}。刪錯了可以按「復原」。`}
          confirmLabel="刪除"
          danger
          onConfirm={onDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

function errorText(e: ExpenseError, isSubsidy: boolean): string {
  switch (e.field) {
    case 'title':
      return '請輸入項目名稱';
    case 'amount':
      return '請輸入金額（整數元）';
    case 'date':
      return '請選擇日期';
    case 'payer':
      if (e.code === 'mismatch') return e.diff > 0 ? `${isSubsidy ? '補貼分配' : '付款金額'}還差 ${formatMoney(e.diff)} 元` : `${isSubsidy ? '補貼分配' : '付款金額'}超出 ${formatMoney(-e.diff)} 元`;
      if (e.code === 'invalid') return '每個人的金額都要大於 0';
      return isSubsidy ? '請選擇補貼給誰' : '請選擇付款人';
    case 'split': {
      const d = e.detail;
      if (d.reason === 'exactMismatch') return d.diff > 0 ? `指定金額還差 ${formatMoney(d.diff)} 元` : `指定金額超出 ${formatMoney(-d.diff)} 元`;
      if (d.reason === 'noParticipants') return '至少要有一個人分攤';
      if (d.reason === 'invalidShare') return '份數只能是 0 以上、最多兩位小數';
      return '分攤設定有誤';
    }
  }
}
