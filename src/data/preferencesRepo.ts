import { Preferences } from '@capacitor/preferences';
import { migrate } from './migrations';
import type { AppData, Repository } from './repository';

const KEY = 'splitapp.data';
const BACKUP_KEY = 'splitapp.data.backup';

/** Capacitor Preferences：Android 上存在 SharedPreferences，瀏覽器預覽時存在 localStorage */
export class PreferencesRepository implements Repository {
  /** 儲存空間無法使用時（例如瀏覽器封鎖），改成只存在記憶體，App 仍可操作 */
  private memoryOnly = false;

  async load(): Promise<AppData> {
    let value: string | null;
    try {
      value = (await Preferences.get({ key: KEY })).value;
    } catch {
      this.memoryOnly = true;
      return migrate(null);
    }
    if (!value) return migrate(null);
    try {
      return migrate(JSON.parse(value));
    } catch (err) {
      // 資料損毀時先備份原始字串，避免直接覆蓋掉
      await Preferences.set({ key: `${BACKUP_KEY}.${Date.now()}`, value });
      throw err;
    }
  }

  async save(data: AppData): Promise<void> {
    if (this.memoryOnly) return;
    await Preferences.set({ key: KEY, value: JSON.stringify(data) });
  }
}
