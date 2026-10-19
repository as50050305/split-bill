/**
 * 瀏覽器預覽版用的範例資料（只有 VITE_DEMO=1 建置時才會載入，APK 不會有）
 */
import type { Expense, SplitSpec, Trip } from './core/types';
import type { AppData } from './data/repository';
import { emptyData } from './data/repository';

/** 元 → 分 */
const y = (n: number) => Math.round(n * 100);

export function demoData(): AppData {
  const d = emptyData();
  const names = ['小明', '小華', '阿杰', '美美', '阿凱'];
  d.members = names.map((name, i) => ({ id: `m${i}`, name }));
  d.groups = [{ id: 'g1', name: '大學死黨', memberIds: ['m0', 'm1', 'm2', 'm3'] }];
  const now = Date.now();

  const bbq: Trip = {
    id: 'bbq',
    name: '週末烤肉',
    mode: 'individual',
    currency: 'TWD',
    members: names.slice(0, 4).map((name, i) => ({ id: `b${i}`, name, savedMemberId: `m${i}` })),
    createdAt: now - 86400000,
    updatedAt: now - 3600000,
  };
  const all4: SplitSpec = { type: 'equal', participants: ['b0', 'b1', 'b2', 'b3'] };
  const e = (id: string, tripId: string, title: string, amount: number, categoryId: Expense['categoryId'], date: string, payerId: string | undefined, split: SplitSpec): Expense => ({
    id, tripId, title, amount: y(amount), categoryId, date, payers: payerId ? { [payerId]: y(amount) } : {}, kind: 'expense', split, createdAt: now,
  });

  const japan: Trip = {
    id: 'jp',
    name: '2026 日本行',
    mode: 'pool',
    currency: 'TWD',
    members: names.slice(0, 3).map((name, i) => ({ id: `j${i}`, name, savedMemberId: `m${i}` })),
    custodianId: 'j0',
    createdAt: now - 2 * 86400000,
    updatedAt: now,
  };
  const all3: SplitSpec = { type: 'equal', participants: ['j0', 'j1', 'j2'] };

  d.trips = [japan, bbq];
  d.expenses = [
    e('x1', 'bbq', '烤肉食材', 1000, 'food', '2026-10-17', 'b0', all4),
    e('x2', 'bbq', '飲料冰塊', 500, 'food', '2026-10-17', 'b1', all4),
    e('x3', 'bbq', '高鐵票', 1490, 'transport', '2026-10-17', 'b2', { type: 'equal', participants: ['b2', 'b3'] }),
    { ...e('x4', 'bbq', '桌菜', 4800, 'food', '2026-10-18', undefined, all4), payers: { b0: y(2400), b1: y(1400), b3: y(1000) } },
    { ...e('x5', 'bbq', '油錢補貼', 800, 'transport', '2026-10-18', undefined, { type: 'equal', participants: ['b1', 'b2', 'b3'] }), kind: 'subsidy', payers: { b0: y(800) } },
    e('y1', 'jp', '溫泉旅館', 2400, 'lodging', '2026-10-12', undefined, all3),
    e('y2', 'jp', '一蘭拉麵', 870, 'food', '2026-10-13', undefined, { type: 'shares', shares: { j0: 1, j1: 1, j2: 1.5 } }),
    e('y3', 'jp', '藥妝店', 650, 'shopping', '2026-10-13', 'j1', { type: 'exact', amounts: { j1: y(650) } }),
  ];
  d.contributions = ['j0', 'j1', 'j2'].map((memberId, i) => ({
    id: `c${i}`, tripId: 'jp', memberId, amount: y(2000), date: '2026-10-12', createdAt: now,
  }));
  return d;
}
