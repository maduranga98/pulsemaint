import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch, type DocumentData, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  EXPENSE_CATEGORIES, EXPENSE_CURRENCIES, EXPENSE_METHODS, sameDayIn,
  type Expense, type ExpenseCategory, type ExpenseCurrency, type ExpenseMethod, type ExpenseRecurrence,
} from '@/lib/platform/expenses';

/** platformExpenses — Lumora's FirmiCore running costs. Superadmins read/write directly (see firestore.rules). */
const col = collection(db, 'platformExpenses');

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const tsMs = (v: unknown): number | null =>
  v && typeof (v as { toMillis?: () => number }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null;

function toExpense(id: string, d: DocumentData): Expense {
  return {
    id,
    date: typeof d.date === 'number' ? d.date : 0,
    category: (EXPENSE_CATEGORIES as readonly string[]).includes(d.category) ? d.category : 'other',
    description: str(d.description), payee: str(d.payee),
    amount: typeof d.amount === 'number' ? d.amount : 0,
    currency: (EXPENSE_CURRENCIES as readonly string[]).includes(d.currency) ? d.currency : 'LKR',
    method: (EXPENSE_METHODS as readonly string[]).includes(d.method) ? d.method : 'other',
    recurrence: d.recurrence === 'monthly' || d.recurrence === 'yearly' ? d.recurrence : 'none',
    reference: str(d.reference), notes: str(d.notes),
    createdAt: tsMs(d.createdAt), createdByEmail: d.createdByEmail ?? null,
  };
}

export function subscribeExpenses(cb: (rows: Expense[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(col, (snap) => cb(snap.docs.map((d) => toExpense(d.id, d.data())).sort((a, b) => b.date - a.date)), onError);
}

export interface ExpenseInput {
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
}

function clean(i: ExpenseInput) {
  return {
    date: i.date, category: i.category, currency: i.currency, method: i.method, recurrence: i.recurrence,
    amount: Math.round(i.amount * 100) / 100,
    description: i.description.trim().slice(0, 300), payee: i.payee.trim().slice(0, 200),
    reference: i.reference.trim().slice(0, 200), notes: i.notes.trim().slice(0, 2000),
  };
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  await addDoc(col, { ...clean(input), createdBy: auth.currentUser?.uid ?? '', createdByEmail: auth.currentUser?.email ?? null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  return updateDoc(doc(col, id), { ...clean(input), updatedAt: serverTimestamp() });
}

export function deleteExpense(id: string): Promise<void> {
  return deleteDoc(doc(col, id));
}

/** Enters this month's copy of each recurring bill (same amount, payee and day of month). */
export async function addRecurringForMonth(bills: Expense[], month: string): Promise<number> {
  const batch = writeBatch(db);
  for (const b of bills) {
    batch.set(doc(col), {
      ...clean({ ...b, date: sameDayIn(b.date, month), reference: '', notes: b.notes }),
      createdBy: auth.currentUser?.uid ?? '', createdByEmail: auth.currentUser?.email ?? null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return bills.length;
}
