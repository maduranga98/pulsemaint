/**
 * Lumora's own FirmiCore running costs (platformExpenses, superadmin only):
 * hosting, domains, SMS/email, ads, commissions and so on. Pure helpers for
 * the Expenses page — monthly totals per currency, category breakdown and the
 * recurring bills not yet entered for a month.
 */

export const EXPENSE_CATEGORIES = [
  'hosting', 'software', 'domain', 'messaging', 'marketing', 'commission', 'salaries', 'payment_fees', 'office', 'tax', 'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  hosting: 'Hosting & cloud (Firebase, Google Cloud)',
  software: 'Software & subscriptions',
  domain: 'Domains & SSL',
  messaging: 'SMS & email',
  marketing: 'Marketing & ads',
  commission: 'Sales commissions',
  salaries: 'Salaries & contractors',
  payment_fees: 'Payment fees (Stripe, bank)',
  office: 'Office & equipment',
  tax: 'Tax & government fees',
  other: 'Other',
};

export const EXPENSE_CURRENCIES = ['LKR', 'USD'] as const;
export type ExpenseCurrency = (typeof EXPENSE_CURRENCIES)[number];
export const EXPENSE_METHODS = ['card', 'bank_transfer', 'cash', 'cheque', 'other'] as const;
export type ExpenseMethod = (typeof EXPENSE_METHODS)[number];
export const EXPENSE_METHOD_LABEL: Record<ExpenseMethod, string> = {
  card: 'Card', bank_transfer: 'Bank transfer', cash: 'Cash', cheque: 'Cheque', other: 'Other',
};
export type ExpenseRecurrence = 'none' | 'monthly' | 'yearly';

export interface Expense {
  id: string;
  /** Paid on, in ms (local date at midnight). */
  date: number;
  category: ExpenseCategory;
  description: string;
  payee: string;
  amount: number;
  currency: ExpenseCurrency;
  method: ExpenseMethod;
  recurrence: ExpenseRecurrence;
  reference: string;
  notes: string;
  createdAt: number | null;
  createdByEmail: string | null;
}

/** "2026-10" for a timestamp, in local time. */
export function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return monthKey(d.getTime());
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export type CurrencyTotals = Partial<Record<ExpenseCurrency, number>>;

export function totalsByCurrency(rows: Pick<Expense, 'amount' | 'currency'>[]): CurrencyTotals {
  const t: CurrencyTotals = {};
  for (const r of rows) t[r.currency] = (t[r.currency] ?? 0) + r.amount;
  return t;
}

/** Category totals per currency, largest first (by the sum across currencies, LKR and USD kept apart). */
export function byCategory(rows: Expense[]): { category: ExpenseCategory; totals: CurrencyTotals; count: number }[] {
  const m = new Map<ExpenseCategory, { totals: CurrencyTotals; count: number }>();
  for (const r of rows) {
    const e = m.get(r.category) ?? { totals: {}, count: 0 };
    e.totals[r.currency] = (e.totals[r.currency] ?? 0) + r.amount;
    e.count++;
    m.set(r.category, e);
  }
  return [...m.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => (b.totals.USD ?? 0) - (a.totals.USD ?? 0) || (b.totals.LKR ?? 0) - (a.totals.LKR ?? 0));
}

/**
 * Recurring bills that are due in `month` but not entered yet: the latest
 * entry of each monthly bill from an earlier month, and yearly bills last
 * paid in the same calendar month a year (or more) before. A bill is the same
 * payee + description + category.
 */
export function missingRecurring(rows: Expense[], month: string): Expense[] {
  const key = (e: Expense) => `${e.category}|${e.payee.trim().toLowerCase()}|${e.description.trim().toLowerCase()}`;
  const inMonth = new Set(rows.filter((e) => monthKey(e.date) === month).map(key));
  const latest = new Map<string, Expense>();
  for (const e of rows) {
    if (e.recurrence === 'none' || monthKey(e.date) >= month) continue;
    const k = key(e);
    const cur = latest.get(k);
    if (!cur || e.date > cur.date) latest.set(k, e);
  }
  return [...latest.values()].filter((e) => {
    if (inMonth.has(key(e))) return false;
    if (e.recurrence === 'monthly') return true;
    return monthKey(e.date).slice(5) === month.slice(5);
  });
}

/** Same day-of-month in `month` (clamped to its last day). */
export function sameDayIn(ms: number, month: string): number {
  const [y, m] = month.split('-').map(Number);
  const day = Math.min(new Date(ms).getDate(), new Date(y, m, 0).getDate());
  return new Date(y, m - 1, day).getTime();
}

export function fmtAmount(amount: number, currency: ExpenseCurrency | string): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function totalsText(t: CurrencyTotals): string {
  const parts = EXPENSE_CURRENCIES.filter((c) => t[c]).map((c) => fmtAmount(t[c]!, c));
  return parts.length ? parts.join(' + ') : '0';
}
