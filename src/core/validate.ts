import { isValidAmount, sum } from './money';
import { validateSplit } from './split';
import type { SplitValidation } from './split';
import type { CategoryId, ExpenseKind, ID, Money, SplitSpec, Trip } from './types';

export interface ExpenseDraft {
  title: string;
  amount: Money;
  categoryId: CategoryId;
  date: string;
  payers: Record<ID, Money>;
  kind?: ExpenseKind;
  split: SplitSpec;
}

export type ExpenseError =
  | { field: 'title'; code: 'required' }
  | { field: 'amount'; code: 'invalid' }
  | { field: 'payer'; code: 'required' | 'unknown' | 'invalid' }
  | { field: 'payer'; code: 'mismatch'; diff: Money }
  | { field: 'date'; code: 'invalid' }
  | { field: 'split'; code: 'invalid'; detail: Exclude<SplitValidation, { ok: true }> };

/** 回傳空陣列＝可以存檔 */
export function validateExpense(draft: ExpenseDraft, trip: Pick<Trip, 'mode' | 'members'>): ExpenseError[] {
  const errors: ExpenseError[] = [];
  const order = trip.members.map((m) => m.id);

  if (!draft.title.trim()) errors.push({ field: 'title', code: 'required' });
  if (!isValidAmount(draft.amount)) errors.push({ field: 'amount', code: 'invalid' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) errors.push({ field: 'date', code: 'invalid' });

  const payerIds = Object.keys(draft.payers);
  const needPayer = trip.mode === 'individual' || draft.kind === 'subsidy';
  if (needPayer && payerIds.length === 0) errors.push({ field: 'payer', code: 'required' });
  else if (payerIds.some((id) => !order.includes(id))) errors.push({ field: 'payer', code: 'unknown' });
  else if (Object.values(draft.payers).some((v) => !isValidAmount(v))) errors.push({ field: 'payer', code: 'invalid' });
  else if (payerIds.length && isValidAmount(draft.amount)) {
    const diff = draft.amount - sum(Object.values(draft.payers));
    if (diff !== 0) errors.push({ field: 'payer', code: 'mismatch', diff });
  }

  if (isValidAmount(draft.amount)) {
    const v = validateSplit(draft.amount, draft.split, order);
    if (!v.ok) errors.push({ field: 'split', code: 'invalid', detail: v });
  }
  return errors;
}
