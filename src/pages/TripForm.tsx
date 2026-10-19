import { useState } from 'react';
import type { Trip, TripMember, TripMode } from '../core/types';
import { AppBar, Avatar, Check, PromptSheet, useToast } from '../components/ui';
import { goBack, navigate } from '../router';
import { addMember, isTripMemberUsed, tripHasRecords, upsertTrip } from '../store/actions';
import { useStore } from '../store/AppStore';
import { cx, newId } from '../utils';

export function TripForm({ tripId }: { tripId?: string }) {
  const { data, update } = useStore();
  const toast = useToast();
  const existing = tripId ? data.trips.find((t) => t.id === tripId) : undefined;
  const locked = existing ? tripHasRecords(data, existing.id) : false;

  const [name, setName] = useState(existing?.name ?? '');
  const [mode, setMode] = useState<TripMode>(existing?.mode ?? 'individual');
  const [members, setMembers] = useState<TripMember[]>(existing?.members ?? []);
  const [custodianId, setCustodianId] = useState<string | undefined>(existing?.custodianId);
  const [tempName, setTempName] = useState('');
  const [saveTemp, setSaveTemp] = useState(true);
  const [pendingFav, setPendingFav] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<TripMember | null>(null);

  if (tripId && !existing) return <NotFound />;

  const hasName = (n: string) => members.some((m) => m.name === n);
  const used = (id: string) => (existing ? isTripMemberUsed(data, existing.id, id) : false);

  const toggleFavorite = (favId: string, favName: string) => {
    const inTrip = members.find((m) => m.savedMemberId === favId);
    if (inTrip) {
      if (used(inTrip.id)) return toast(`${inTrip.name} 已有記帳紀錄，不能移除`);
      setMembers((ms) => ms.filter((m) => m.id !== inTrip.id));
      if (custodianId === inTrip.id) setCustodianId(undefined);
    } else {
      if (hasName(favName)) return toast(`旅程裡已經有「${favName}」`);
      setMembers((ms) => [...ms, { id: newId(), name: favName, savedMemberId: favId }]);
    }
  };

  const addGroup = (memberIds: string[]) => {
    const toAdd = data.members.filter(
      (f) => memberIds.includes(f.id) && !members.some((m) => m.savedMemberId === f.id || m.name === f.name),
    );
    setMembers((ms) => [...ms, ...toAdd.map((f) => ({ id: newId(), name: f.name, savedMemberId: f.id }))]);
    toast(toAdd.length ? `已帶入 ${toAdd.length} 人` : '群組成員都已經在名單裡');
  };

  const addTemp = () => {
    const n = tempName.trim();
    if (!n) return;
    if (hasName(n)) return toast(`旅程裡已經有「${n}」`);
    const fav = data.members.find((f) => f.name === n);
    const m: TripMember = { id: newId(), name: n, savedMemberId: fav?.id };
    setMembers((ms) => [...ms, m]);
    if (!fav && saveTemp) setPendingFav((s) => new Set(s).add(m.id));
    setTempName('');
  };

  const removeMember = (m: TripMember) => {
    if (used(m.id)) return toast(`${m.name} 已有記帳紀錄，不能移除`);
    setMembers((ms) => ms.filter((x) => x.id !== m.id));
    if (custodianId === m.id) setCustodianId(undefined);
  };

  const moveUp = (i: number) =>
    setMembers((ms) => {
      if (i === 0) return ms;
      const next = [...ms];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });

  const problems: string[] = [];
  if (!name.trim()) problems.push('請輸入旅程名稱');
  if (members.length < 2) problems.push('至少要 2 位成員');
  if (mode === 'pool' && !members.some((m) => m.id === custodianId)) problems.push('請選擇保管人');

  const save = () => {
    if (problems.length) return;
    // 勾選「存入常用」的臨時成員，在存檔時才加入常用名單
    const finalMembers = members.map((m) => (pendingFav.has(m.id) ? { ...m, savedMemberId: newId() } : m));
    const now = Date.now();
    const trip: Trip = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      mode,
      currency: 'TWD',
      members: finalMembers,
      custodianId: mode === 'pool' ? custodianId : undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    update((d) => {
      let next = d;
      for (const m of finalMembers) {
        if (pendingFav.has(m.id) && m.savedMemberId) next = addMember(next, { id: m.savedMemberId, name: m.name });
      }
      return upsertTrip(next, trip);
    });
    if (existing) goBack();
    else navigate({ name: 'trip', tripId: trip.id, tab: 'expenses' }, { replace: true });
  };

  return (
    <>
      <AppBar title={existing ? '編輯旅程' : '新增旅程'} back />
      <main className="page">
        <div className="stack">
          <div className="field">
            <label htmlFor="trip-name">旅程名稱</label>
            <input
              id="trip-name"
              className="input"
              value={name}
              maxLength={40}
              placeholder="例如：2026 日本行"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field">
            <span className="field-label">計算模式{locked && '（已有紀錄，不能更改）'}</span>
            <div className="stack" style={{ gap: 8 }}>
              <ModeOption
                active={mode === 'individual'}
                disabled={locked}
                title="各自付款制"
                desc="每筆由不同人付錢，最後算出誰該轉給誰（最少轉帳次數）"
                onClick={() => setMode('individual')}
              />
              <ModeOption
                active={mode === 'pool'}
                disabled={locked}
                title="公費制"
                desc="大家先把錢交給一位保管人，花費從公費扣，最後由保管人多退少補"
                onClick={() => setMode('pool')}
              />
            </div>
          </div>

          <div className="field">
            <span className="field-label">成員（{members.length} 人，排序＝零頭分配順序）</span>
            {members.length > 0 && (
              <div className="list">
                {members.map((m, i) => (
                  <div className="member-row" key={m.id}>
                    <Avatar name={m.name} index={i} />
                    <button className="name" style={{ background: 'none', border: 0, textAlign: 'left', padding: '10px 0' }} onClick={() => setRenaming(m)}>
                      {m.name}
                      {pendingFav.has(m.id) && <span className="faint" style={{ fontSize: 13 }}> · 將存入常用</span>}
                    </button>
                    {i > 0 && (
                      <button className="icon-btn" aria-label="上移" onClick={() => moveUp(i)}>
                        ↑
                      </button>
                    )}
                    <button className="icon-btn" aria-label="移除" onClick={() => removeMember(m)} style={{ opacity: used(m.id) ? 0.3 : 1 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.groups.length > 0 && (
            <div className="field">
              <span className="field-label">一鍵帶入群組</span>
              <div className="chips">
                {data.groups.map((g) => (
                  <button key={g.id} className="chip dashed" onClick={() => addGroup(g.memberIds)}>
                    👥 {g.name}（{g.memberIds.length}）
                  </button>
                ))}
              </div>
            </div>
          )}

          {data.members.length > 0 && (
            <div className="field">
              <span className="field-label">從常用成員勾選</span>
              <div className="chips">
                {data.members.map((f) => {
                  const on = members.some((m) => m.savedMemberId === f.id);
                  return (
                    <button key={f.id} className={on ? 'chip on' : 'chip'} onClick={() => toggleFavorite(f.id, f.name)}>
                      {on && '✓ '}
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="field">
            <span className="field-label">臨時新增成員</span>
            <div className="btn-row">
              <input
                className="input"
                style={{ flex: 2 }}
                placeholder="名字"
                value={tempName}
                maxLength={30}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTemp()}
              />
              <button className="btn" disabled={!tempName.trim()} onClick={addTemp}>
                加入
              </button>
            </div>
            <button
              className="row"
              style={{ minHeight: 48, padding: '4px', border: 0 }}
              onClick={() => setSaveTemp((v) => !v)}
            >
              <Check on={saveTemp} />
              <span>同時存入常用成員</span>
            </button>
          </div>

          {mode === 'pool' && (
            <div className="field">
              <span className="field-label">保管人（負責拿公費的人）</span>
              {members.length === 0 ? (
                <p className="faint" style={{ paddingLeft: 4 }}>先加入成員</p>
              ) : (
                <div className="chips">
                  {members.map((m) => (
                    <button key={m.id} className={custodianId === m.id ? 'chip on' : 'chip'} onClick={() => setCustodianId(m.id)}>
                      {custodianId === m.id && '💰 '}
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <div className="sticky-actions">
        {problems.length > 0 && <p className="hint muted">{problems[0]}</p>}
        <button className="btn primary block lg" disabled={problems.length > 0} onClick={save}>
          {existing ? '儲存變更' : '建立旅程'}
        </button>
      </div>

      {renaming && (
        <PromptSheet
          title="修改這個旅程裡的名字"
          initial={renaming.name}
          onSubmit={(n) => {
            if (n !== renaming.name && hasName(n)) return toast(`旅程裡已經有「${n}」`);
            setMembers((ms) => ms.map((m) => (m.id === renaming.id ? { ...m, name: n } : m)));
          }}
          onClose={() => setRenaming(null)}
        />
      )}
    </>
  );
}

function ModeOption(p: { active: boolean; disabled: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      className={cx('card', 'row')}
      disabled={p.disabled && !p.active}
      style={{
        borderColor: p.active ? 'var(--accent)' : undefined,
        background: p.active ? 'var(--accent-soft)' : undefined,
        opacity: p.disabled && !p.active ? 0.4 : 1,
        alignItems: 'flex-start',
      }}
      onClick={p.onClick}
    >
      <Check on={p.active} round />
      <div className="grow">
        <div style={{ fontWeight: 700, fontSize: 17, color: p.active ? 'var(--accent)' : undefined }}>{p.title}</div>
        <div className="muted" style={{ fontSize: 14, whiteSpace: 'normal' }}>
          {p.desc}
        </div>
      </div>
    </button>
  );
}

export function NotFound() {
  return (
    <>
      <AppBar title="找不到" back />
      <main className="page">
        <div className="empty">
          <div className="big">🤔</div>
          <p>找不到這筆資料，可能已被刪除</p>
        </div>
      </main>
    </>
  );
}
