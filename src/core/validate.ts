import { isValidAmount } from './money';
import { validateSplit } from './split';
import type { SplitValidation } from './split';
import type { CategoryId, ID, Money, SplitSpec, Trip } from './types';

export interface ExpenseDraft {
  title: string;
  amount: Money;
  categoryId: CategoryId;
  date: string;
  payerId?: ID;
  split: SplitSpec;
}

export type ExpenseError =
  | { field: 'title'; code: 'required' }
  | { field: 'amount'; code: 'invalid' }
  | { field: 'payer'; code: 'required' | 'unknown' }
  | { field: 'date'; code: 'invalid' }
  | { field: 'split'; code: 'invalid'; detail: Exclude<SplitValidation, { ok: true }> };

/** 回傳空陣列＝可以存檔 */
export function validateExpense(draft: ExpenseDraft, trip: Pick<Trip, 'mode' | 'members'>): ExpenseError[] {
  const errors: ExpenseError[] = [];
  const order = trip.members.map((m) => m.id);

  if (!draft.title.trim()) errors.push({ field: 'title', code: 'required' });
  if (!isValidAmount(draft.amount)) errors.push({ field: 'amount', code: 'invalid' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) errors.push({ field: 'date', code: 'invalid' });

  if (trip.mode === 'individual' && !draft.payerId) errors.push({ field: 'payer', code: 'required' });
  if (draft.payerId && !order.includes(draft.payerId)) errors.push({ field: 'payer', code: 'unknown' });

  if (isValidAmount(draft.amount)) {
    const v = validateSplit(draft.amount, draft.split, order);
    if (!v.ok) errors.push({ field: 'split', code: 'invalid', detail: v });
  }
  return errors;
}
