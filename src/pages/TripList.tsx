import { useState } from 'react';
import { formatMoney, sum } from '../core/money';
import type { Trip } from '../core/types';
import { Icon } from '../components/icons';
import { AppBar, BottomNav, ConfirmSheet, Empty, Fab, Sheet, Sq, useToast } from '../components/ui';
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
      <AppBar eyebrow="Split Bill" title="分帳本" />
      <main className="page">
        {trips.length === 0 ? (
          <Empty icon="suitcase" tone="sage" title="還沒有旅程" hint="按右下角「新增旅程」開始記帳" />
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
                  <span className={t.mode === 'pool' ? 'tile tone-clay' : 'tile tone-blue'}>
                    <Icon name={t.mode === 'pool' ? 'wallet' : 'users'} />
                  </span>
                  <div className="grow">
                    <h3>{t.name}</h3>
                    <div className="meta">
                      {t.mode === 'pool' ? '公費制' : '各自付款'} · {t.members.length} 人 · {t.members.map((m) => m.name).join('、')}
                    </div>
                    <div className="total">
                      <small>NT$</small>
                      {formatMoney(total)}
                    </div>
                  </div>
                  <Sq
                    icon="more"
                    label="更多"
                    flat
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuFor(t);
                    }}
                  />
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
          <div className="stack" style={{ marginTop: 16, gap: 8 }}>
            <button
              className="menu-item"
              onClick={() => {
                const id = menuFor.id;
                setMenuFor(null);
                navigate({ name: 'tripEdit', tripId: id });
              }}
            >
              <span className="tile tone-blue" style={{ width: 40, height: 40 }}>
                <Icon name="edit" size={20} />
              </span>
              編輯旅程
            </button>
            <button
              className="menu-item"
              onClick={() => {
                setConfirmDelete(menuFor);
                setMenuFor(null);
              }}
            >
              <span className="tile tone-rose" style={{ width: 40, height: 40 }}>
                <Icon name="trash" size={20} />
              </span>
              刪除旅程
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
