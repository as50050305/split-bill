import type { Contribution, Expense, Group, Member, Payment, Trip } from '../core/types';

export const SCHEMA_VERSION = 2;

/** 整個 App 的資料。v1 資料量小，整包存取即可 */
export interface AppData {
  schemaVersion: number;
  members: Member[];
  groups: Group[];
  trips: Trip[];
  expenses: Expense[];
  contributions: Contribution[];
  payments: Payment[];
}

export function emptyData(): AppData {
  return { schemaVersion: SCHEMA_VERSION, members: [], groups: [], trips: [], expenses: [], contributions: [], payments: [] };
}

/**
 * 儲存層介面。UI 只依賴這個介面：
 * v1 用 Capacitor Preferences；之後換 SQLite、加雲端同步，只要新增一個實作。
 */
export interface Repository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}
