import { useState } from 'react';
import { formatMoney, sum } from '../core/money';
import type { Trip } from '../core/types';
import { AppBar, BottomNav, ConfirmSheet, Fab, Sheet, useToast } from '../components/ui';
import { navigate } from '../router';
import { deleteTrip } from '../store/actions';
import { useStore } from '../store/AppStore';

export function TripList() {
  const { data, update } = useStore();
  const toast = useToast();
  const [menuFor, setMenuFor] = useState<Trip | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Trip | null>(null);

  const trips = [...data.trips].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <AppBar title="分帳本" />
      <main className="page">
        {trips.length === 0 ? (
          <div className="empty">
            <div className="big">🧳</div>
            <p>還沒有旅程</p>
            <p className="faint" style={{ fontSize: 14, marginTop: 4 }}>
              按右下角「新增旅程」開始記帳
            </p>
          </div>
        ) : (
          <div className="stack">
            {trips.map((t) => {
              const total = sum(data.expenses.filter((e) => e.tripId === t.id).map((e) => e.amount));
              return (
                <div
                  key={t.id}
                  className="trip-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate({ name: 'trip', tripId: t.id, tab: 'expenses' })}
                >
                  <div className="trip-card-head">
                    <h3>{t.name}</h3>
                    <button
                      className="icon-btn"
                      aria-label="更多"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuFor(t);
                      }}
                    >
                      ⋯
                    </button>
                  </div>
                  <div className="meta">
                    <span className={t.mode === 'pool' ? 'badge accent' : 'badge'}>
                      {t.mode === 'pool' ? '公費制' : '各自付款'}
                    </span>
                    <span>{t.members.length} 人</span>
                    <span>·</span>
                    <span>{t.members.map((m) => m.name).join('、')}</span>
                  </div>
                  <div className="total">NT$ {formatMoney(total)}</div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Fab label="新增旅程" onClick={() => navigate({ name: 'tripNew' })} />
      <BottomNav active="trips" />

      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)}>
          <h2>{menuFor.name}</h2>
          <div className="stack" style={{ marginTop: 16 }}>
            <button
              className="btn block lg"
              onClick={() => {
                const id = menuFor.id;
                setMenuFor(null);
                navigate({ name: 'tripEdit', tripId: id });
              }}
            >
              ✏️ 編輯旅程
            </button>
            <button
              className="btn block lg danger"
              onClick={() => {
                setConfirmDelete(menuFor);
                setMenuFor(null);
              }}
            >
              🗑️ 刪除旅程
            </button>
          </div>
        </Sheet>
      )}
      {confirmDelete && (
        <ConfirmSheet
          title={`刪除「${confirmDelete.name}」？`}
          body="這個旅程的所有支出、公費和還款紀錄都會一起刪除，無法復原。"
          confirmLabel="確定刪除"
          danger
          onConfirm={() => {
            update((d) => deleteTrip(d, confirmDelete.id));
            toast('已刪除旅程');
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
