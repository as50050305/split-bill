import { useState } from 'react';
import type { Group, Member } from '../core/types';
import { Icon } from '../components/icons';
import { AppBar, Avatar, BottomNav, ConfirmSheet, Empty, Fab, Pill, PromptSheet, Sheet, Sq, useToast } from '../components/ui';
import { addMember, deleteGroup, deleteMember, renameMember, upsertGroup } from '../store/actions';
import { useStore } from '../store/AppStore';
import { newId } from '../utils';

export function Favorites() {
  const { data, update } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<'members' | 'groups'>('members');
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const nameOf = (id: string) => data.members.find((m) => m.id === id)?.name;

  return (
    <>
      <AppBar title="常用名單">
        <div className="tabs">
          <button className={tab === 'members' ? 'tab active' : 'tab'} onClick={() => setTab('members')}>
            常用成員 {data.members.length}
          </button>
          <button className={tab === 'groups' ? 'tab active' : 'tab'} onClick={() => setTab('groups')}>
            常用群組 {data.groups.length}
          </button>
        </div>
      </AppBar>
      <main className="page with-tabs">
        {tab === 'members' &&
          (data.members.length === 0 ? (
            <Empty icon="userPlus" tone="sage" title="還沒有常用成員" hint="把常一起出去的朋友加進來，建立旅程時一鍵勾選" />
          ) : (
            <div className="list">
              {data.members.map((m, i) => (
                <div className="member-row" key={m.id}>
                  <Avatar name={m.name} index={i} />
                  <button className="name" onClick={() => setRenaming(m)}>
                    {m.name}
                  </button>
                  <Sq icon="edit" label="改名" small onClick={() => setRenaming(m)} />
                  <Sq icon="trash" label="刪除" small onClick={() => setDeleting(m)} />
                </div>
              ))}
            </div>
          ))}

        {tab === 'groups' &&
          (data.groups.length === 0 ? (
            <Empty icon="users" tone="lilac" title="還沒有常用群組" hint="例如「大學死黨 5 人組」，建立旅程時一鍵帶入" />
          ) : (
            <div className="list">
              {data.groups.map((g) => (
                <button className="row" key={g.id} onClick={() => setEditingGroup(g)}>
                  <span className="tile tone-lilac">
                    <Icon name="users" />
                  </span>
                  <div className="grow">
                    <div className="title">{g.name}</div>
                    <div className="sub">
                      {g.memberIds.length} 人 · {g.memberIds.map(nameOf).filter(Boolean).join('、') || '（沒有成員）'}
                    </div>
                  </div>
                  <span className="faint" style={{ transform: 'rotate(180deg)' }}>
                    <Icon name="back" size={18} />
                  </span>
                </button>
              ))}
            </div>
          ))}
      </main>

      {tab === 'members' ? (
        <Fab label="新增成員" icon="userPlus" onClick={() => setAdding(true)} />
      ) : (
        <Fab label="新增群組" icon="users" tone="blue" onClick={() => setEditingGroup({ id: newId(), name: '', memberIds: [] })} />
      )}
      <BottomNav active="favorites" />

      {adding && (
        <PromptSheet
          title="新增常用成員"
          placeholder="名字"
          confirmLabel="新增"
          onSubmit={(name) => {
            if (data.members.some((m) => m.name === name)) return toast(`「${name}」已經在名單裡`);
            update((d) => addMember(d, { id: newId(), name }));
            toast(`已新增 ${name}`);
          }}
          onClose={() => setAdding(false)}
        />
      )}
      {renaming && (
        <PromptSheet
          title="修改名字"
          initial={renaming.name}
          onSubmit={(name) => update((d) => renameMember(d, renaming.id, name))}
          onClose={() => setRenaming(null)}
        />
      )}
      {deleting && (
        <ConfirmSheet
          title={`刪除「${deleting.name}」？`}
          body="會從常用名單和群組中移除。已建立的旅程不受影響。"
          confirmLabel="刪除"
          danger
          onConfirm={() => update((d) => deleteMember(d, deleting.id))}
          onClose={() => setDeleting(null)}
        />
      )}
      {editingGroup && (
        <GroupEditor
          group={editingGroup}
          members={data.members}
          isNew={!data.groups.some((g) => g.id === editingGroup.id)}
          onSave={(g) => update((d) => upsertGroup(d, g))}
          onDelete={() => update((d) => deleteGroup(d, editingGroup.id))}
          onAddMember={(name) => {
            const m = { id: newId(), name };
            update((d) => addMember(d, m));
            return m;
          }}
          onClose={() => setEditingGroup(null)}
        />
      )}
    </>
  );
}

function GroupEditor({
  group,
  members,
  isNew,
  onSave,
  onDelete,
  onAddMember,
  onClose,
}: {
  group: Group;
  members: Member[];
  isNew: boolean;
  onSave: (g: Group) => void;
  onDelete: () => void;
  onAddMember: (name: string) => Member;
  onClose: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [ids, setIds] = useState<string[]>(group.memberIds);
  const [confirm, setConfirm] = useState(false);
  const [newName, setNewName] = useState('');
  const toggle = (id: string) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const ok = name.trim() && ids.length > 0;

  const addNew = () => {
    const n = newName.trim();
    if (!n) return;
    const existing = members.find((m) => m.name === n);
    const m = existing ?? onAddMember(n);
    setIds((s) => (s.includes(m.id) ? s : [...s, m.id]));
    setNewName('');
  };

  return (
    <Sheet onClose={onClose}>
      <h2>{isNew ? '新增群組' : '編輯群組'}</h2>
      <div className="stack" style={{ marginTop: 12 }}>
        <div className="field">
          <label>群組名稱</label>
          <input className="input" value={name} maxLength={30} placeholder="例如：大學死黨" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <span className="field-label">成員（已選 {ids.length} 人）</span>
          <div className="chips">
            {members.map((m) => (
              <button key={m.id} className={ids.includes(m.id) ? 'chip on' : 'chip'} onClick={() => toggle(m.id)}>
                {ids.includes(m.id) && <Icon name="check" size={16} />}
                {m.name}
              </button>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 4 }}>
            <input
              className="input"
              style={{ flex: 2 }}
              placeholder="新名字（也會存入常用成員）"
              value={newName}
              maxLength={30}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNew()}
            />
            <button className="btn" disabled={!newName.trim()} onClick={addNew}>
              加入
            </button>
          </div>
        </div>
      </div>
      <div className="stack">
        <Pill
          block
          label="儲存群組"
          icon="check"
          disabled={!ok}
          onClick={() => {
            onSave({ ...group, name: name.trim(), memberIds: ids });
            onClose();
          }}
        />
        {!isNew && (
          <button className="btn danger block" onClick={() => setConfirm(true)}>
            刪除群組
          </button>
        )}
      </div>
      {confirm && (
        <ConfirmSheet
          title={`刪除群組「${group.name}」？`}
          body="只刪除群組，成員本身會保留在常用名單。"
          confirmLabel="刪除"
          danger
          onConfirm={() => {
            onDelete();
            onClose();
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </Sheet>
  );
}
