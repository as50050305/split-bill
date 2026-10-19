import { useState } from 'react';
import { formatMoney } from '../core/money';
import { AppBar, Avatar, Check, MoneyInput, useToast } from '../components/ui';
import { goBack } from '../router';
import { addContributions } from '../store/actions';
import { useStore } from '../store/AppStore';
import { newId, today } from '../utils';
import { NotFound } from './TripForm';

export function ContributionForm({ tripId }: { tripId: string }) {
  const { data, update } = useStore();
  const toast = useToast();
  const trip = data.trips.find((t) => t.id === tripId);
  const [amount, setAmount] = useState<number | null>(null);
  const [who, setWho] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(today());
  if (!trip) return <NotFound />;

  const allOn = who.size === trip.members.length;
  const toggle = (id: string) =>
    setWho((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const ok = !!amount && who.size > 0;

  const save = () => {
    if (!ok) return;
    const now = Date.now();
    update((d) =>
      addContributions(
        d,
        trip.members
          .filter((m) => who.has(m.id))
          .map((m) => ({ id: newId(), tripId, memberId: m.id, amount: amount!, date, createdAt: now })),
      ),
    );
    toast(`已記錄 ${who.size} 人各投入 ${formatMoney(amount!)}`);
    goBack();
  };

  return (
    <>
      <AppBar title="投入公費" back />
      <main className="page">
        <div className="stack">
          <MoneyInput value={amount} onChange={setAmount} size="big" autoFocus ariaLabel="每人投入金額" />
          <p className="faint" style={{ fontSize: 13, paddingLeft: 4 }}>
            勾選多人＝每個人各投入這個金額
          </p>
          <div className="list">
            <button
              className="split-row"
              style={{ width: '100%', background: 'var(--surface-2)', border: 0, minHeight: 52 }}
              onClick={() => setWho(allOn ? new Set() : new Set(trip.members.map((m) => m.id)))}
            >
              <span className="who" style={{ fontSize: 15, padding: 0 }}>
                <Check on={allOn} />
                <span>全部人</span>
              </span>
            </button>
            {trip.members.map((m, i) => (
              <div key={m.id} className="split-row">
                <button className="who" onClick={() => toggle(m.id)}>
                  <Check on={who.has(m.id)} />
                  <Avatar name={m.name} index={i} />
                  <span>
                    {m.name}
                    {m.id === trip.custodianId && <span className="faint" style={{ fontSize: 13 }}> · 保管人</span>}
                  </span>
                </button>
              </div>
            ))}
          </div>
          <div className="field">
            <label htmlFor="cdate">日期</label>
            <input id="cdate" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </main>
      <div className="sticky-actions">
        {ok && who.size > 1 && (
          <p className="hint muted">
            共 {who.size} 人 × {formatMoney(amount!)} = NT$ {formatMoney(amount! * who.size)}
          </p>
        )}
        <button className="btn primary block lg" disabled={!ok} onClick={save}>
          記錄投入
        </button>
      </div>
    </>
  );
}
