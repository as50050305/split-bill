import { SCHEMA_VERSION, emptyData } from './repository';
import type { AppData } from './repository';

/**
 * 資料版本升級。之後改資料結構時：
 * 1. SCHEMA_VERSION + 1
 * 2. 在 steps 加一個 { from: 舊版號, up: (d) => 新格式 }
 */
const steps: { from: number; up: (d: any) => any }[] = [
  // 範例：{ from: 1, up: (d) => ({ ...d, schemaVersion: 2, trips: d.trips.map(...) }) },
];

export function migrate(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return emptyData();
  let data: any = { ...emptyData(), ...(raw as object) };
  for (const step of steps) {
    if (data.schemaVersion === step.from) data = step.up(data);
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`無法辨識的資料版本 ${data.schemaVersion}`);
  }
  return data as AppData;
}
