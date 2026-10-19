import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { emptyData } from '../data/repository';
import type { AppData, Repository } from '../data/repository';

interface Store {
  data: AppData;
  /** 套用一個純函式變更，並自動存檔 */
  update: (fn: (d: AppData) => AppData) => void;
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(Promise.resolve());

  useEffect(() => {
    repo
      .load()
      .then(async (d) => {
        // 預覽版：第一次打開時放入範例資料
        if (import.meta.env.VITE_DEMO === '1' && d.trips.length === 0 && d.members.length === 0) {
          const { demoData } = await import('../demo');
          return demoData();
        }
        return d;
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [repo]);

  const update = useCallback(
    (fn: (d: AppData) => AppData) => {
      setData((prev) => {
        const next = fn(prev ?? emptyData());
        // 依序寫入，避免快速連續操作時舊資料蓋掉新資料
        saving.current = saving.current.then(() => repo.save(next)).catch((e) => setError(String(e)));
        return next;
      });
    },
    [repo],
  );

  if (error) {
    return (
      <div className="fatal">
        <h2>資料讀取失敗</h2>
        <p>{error}</p>
        <p className="muted">原始資料已備份，請聯絡開發者。</p>
      </div>
    );
  }
  if (!data) return <div className="splash">載入中…</div>;
  return <Ctx.Provider value={{ data, update }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
