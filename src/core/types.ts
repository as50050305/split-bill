/**
 * 核心資料型別。core/ 底下全部是純函式，不碰 UI、不碰儲存。
 *
 * 金額 Money 一律是「最小貨幣單位的整數」。TWD 的最小單位就是「元」，
 * 之後加多幣別時（例如 USD 以「分」為單位），只要在 Trip.currency 上換幣別即可。
 */

export type ID = string;
export type Money = number;
export type CurrencyCode = 'TWD';

/** pool = 模式一 公費制；individual = 模式二 各自付款制 */
export type TripMode = 'pool' | 'individual';

export type ExpenseKind = 'expense' | 'subsidy';

export type CategoryId = 'food' | 'transport' | 'lodging' | 'ticket' | 'shopping' | 'other';

/** 分攤方式。沒出現在名單裡（或份數/金額為 0）的成員＝不分攤這一筆 */
export type SplitSpec =
  | { type: 'equal'; participants: ID[] }
  | { type: 'shares'; shares: Record<ID, number> }
  | { type: 'exact'; amounts: Record<ID, Money> };

export interface Member {
  id: ID;
  name: string;
}

export interface Group {
  id: ID;
  name: string;
  memberIds: ID[];
}

/** 旅程內的成員快照：改常用名字不會動到舊帳 */
export interface TripMember {
  id: ID;
  name: string;
  savedMemberId?: ID;
}

export interface Trip {
  id: ID;
  name: string;
  mode: TripMode;
  currency: CurrencyCode;
  /** 順序有意義：零頭分配、同額時的排序都依這個順序 */
  members: TripMember[];
  /** 模式一的保管人 */
  custodianId?: ID;
  createdAt: number;
  updatedAt: number;
}

export interface Expense {
  id: ID;
  tripId: ID;
  title: string;
  amount: Money;
  categoryId: CategoryId;
  /** YYYY-MM-DD */
  date: string;
  /**
   * 誰出了這筆錢、各出多少（總和必須等於 amount）。可以多人（例如桌菜大家湊錢）。
   * 模式二：至少一人。
   * 模式一：空物件＝從公費支出；有人＝這些人自掏腰包代墊（視為他們投入同額公費再支出）。
   * kind 為 subsidy 時，這裡代表「收到補貼的人」（例如開車的人）。
   */
  payers: Record<ID, Money>;
  /** expense＝一般支出（預設）；subsidy＝補貼，例如油錢，沒有實際付款，錢直接給收補貼的人 */
  kind?: ExpenseKind;
  split: SplitSpec;
  note?: string;
  createdAt: number;
}

/** 模式一：投入公費 */
export interface Contribution {
  id: ID;
  tripId: ID;
  memberId: ID;
  amount: Money;
  date: string;
  createdAt: number;
}

/** 「已還款」紀錄：from 實際付了 amount 給 to */
export interface Payment {
  id: ID;
  tripId: ID;
  fromId: ID;
  toId: ID;
  amount: Money;
  date: string;
  createdAt: number;
}

export interface Transfer {
  fromId: ID;
  toId: ID;
  amount: Money;
}
