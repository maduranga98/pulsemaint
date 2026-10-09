import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Repeat, Trash2, Wallet } from 'lucide-react';
import {
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, EXPENSE_CURRENCIES, EXPENSE_METHODS, EXPENSE_METHOD_LABEL,
  byCategory, fmtAmount, missingRecurring, monthKey, monthLabel, shiftMonth, totalsByCurrency, totalsText,
  type Expense, type ExpenseCategory,
} from '@/lib/platform/expenses';
import { addRecurringForMonth, createExpense, deleteExpense, subscribeExpenses, updateExpense, type ExpenseInput } from '@/services/platformExpensesService';
import { platformService } from '@/services/platformService';
import { Card, ErrorNote, Loading, PageHeader, Stat, btn, input } from './platformUi';
import { Field, Modal } from './leads/leadUi';
import ExportButtons from './ExportButtons';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fromDateInput = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

const blank = (): ExpenseInput => ({
  date: fromDateInput(toDateInput(Date.now())), category: 'hosting', description: '', payee: '', amount: 0, currency: 'LKR',
  method: 'card', recurrence: 'none', reference: '', notes: '',
});

/**
 * What it costs Lumora to run FirmiCore — hosting, domains, SMS/email, ads,
 * commissions, salaries… Monthly totals per currency, a category breakdown,
 * FirmiCore's Stripe income for the same month, and recurring bills that are
 * due but not entered yet.
 */
export default function PlatformExpensesPage() {
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => monthKey(Date.now()));
  const [allTime, setAllTime] = useState(false);
  const [category, setCategory] = useState<'' | ExpenseCategory>('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ id?: string; draft: ExpenseInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const [income, setIncome] = useState<{ created: number; amountPaid: number; currency: string }[] | null>(null);

  useEffect(() => subscribeExpenses(setRows, (e) => setError(e.message)), []);
  useEffect(() => {
    platformService.listPayments().then((r) => setIncome(r.payments)).catch(() => setIncome([]));
  }, []);

  const inMonth = useMemo(() => (rows ?? []).filter((e) => monthKey(e.date) === month), [rows, month]);
  const lastMonth = useMemo(() => (rows ?? []).filter((e) => monthKey(e.date) === shiftMonth(month, -1)), [rows, month]);
  const thisYear = useMemo(() => (rows ?? []).filter((e) => monthKey(e.date).slice(0, 4) === month.slice(0, 4)), [rows, month]);
  const scope = allTime ? rows ?? [] : inMonth;
  const filtered = useMemo(() => scope.filter((e) => {
    if (category && e.category !== category) return false;
    const n = q.trim().toLowerCase();
    return !n || [e.description, e.payee, e.reference, e.notes].some((v) => v.toLowerCase().includes(n));
  }), [scope, category, q]);
  const categories = useMemo(() => byCategory(scope), [scope]);
  const missing = useMemo(() => (rows ? missingRecurring(rows, month) : []), [rows, month]);

  const monthTotals = totalsByCurrency(inMonth);
  const incomeUsd = income === null ? null
    : income.filter((p) => monthKey(p.created) === month && p.currency?.toLowerCase() === 'usd').reduce((s, p) => s + p.amountPaid / 100, 0);
  const scopeTotals = totalsByCurrency(scope);
  const maxCategory = Math.max(1, ...categories.map((c) => (c.totals.USD ?? 0) * 300 + (c.totals.LKR ?? 0)));

  async function save() {
    if (!editing) return;
    const { draft } = editing;
    if (!draft.description.trim() || !(draft.amount > 0)) {
      setError('Description and an amount above 0 are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editing.id) await updateExpense(editing.id, draft);
      else await createExpense(draft);
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addRecurring() {
    setBusy(true);
    try {
      await addRecurringForMonth(missing, month);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const d = editing?.draft;
  const set = (patch: Partial<ExpenseInput>) => editing && setEditing({ ...editing, draft: { ...editing.draft, ...patch } });

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="What it costs to run FirmiCore — hosting, domains, SMS & email, ads, commissions, salaries. Compare each month's spend with FirmiCore's Stripe income."
        actions={<>
          {rows && rows.length > 0 && (
            <ExportButtons
              filename={`firmicore-expenses-${allTime ? 'all' : month}`}
              sheetName="Expenses"
              header={['Date', 'Category', 'Description', 'Paid to', 'Amount', 'Currency', 'Method', 'Recurring', 'Reference', 'Notes', 'Added by']}
              rows={() => filtered.map((e) => [
                toDateInput(e.date), EXPENSE_CATEGORY_LABEL[e.category], e.description, e.payee, e.amount, e.currency,
                EXPENSE_METHOD_LABEL[e.method], e.recurrence === 'none' ? '' : e.recurrence, e.reference, e.notes, e.createdByEmail ?? '',
              ])}
            />
          )}
          <button className={`${btn.primary} inline-flex items-center gap-1.5`} onClick={() => setEditing({ draft: { ...blank(), date: monthKey(Date.now()) === month ? blank().date : fromDateInput(`${month}-01`) } })}>
            <Plus className="h-4 w-4" /> Add expense
          </button>
        </>}
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-lg border border-[#1E3A5F] bg-[#0F1E35]">
          <button className="rounded-l-lg p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40" disabled={allTime} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[150px] px-2 text-center text-sm font-semibold text-white">{allTime ? 'All time' : monthLabel(month)}</span>
          <button className="rounded-r-lg p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40" disabled={allTime} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
        </div>
        {!allTime && month !== monthKey(Date.now()) && <button className="text-xs text-blue-300 hover:underline" onClick={() => setMonth(monthKey(Date.now()))}>This month</button>}
        <label className="ml-1 flex items-center gap-1.5 text-xs text-slate-400"><input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} /> All time</label>
      </div>

      {!rows && !error ? <Loading /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={`Spent in ${monthLabel(month)}`} value={totalsText(monthTotals)} tone="red" hint={`${inMonth.length} expense(s)`} />
            <Stat label="Last month" value={totalsText(totalsByCurrency(lastMonth))} hint={monthLabel(shiftMonth(month, -1))} />
            <Stat label={`Year ${month.slice(0, 4)}`} value={totalsText(totalsByCurrency(thisYear))} hint={`${thisYear.length} expense(s)`} />
            <Stat
              label="FirmiCore income (Stripe)"
              value={incomeUsd === null ? '…' : fmtAmount(incomeUsd, 'USD')}
              tone="green"
              hint={incomeUsd === null ? monthLabel(month) : `Net USD ${(incomeUsd - (monthTotals.USD ?? 0)).toLocaleString('en-US', { maximumFractionDigits: 2 })} after USD expenses`}
            />
          </div>

          {missing.length > 0 && !allTime && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-700/50 bg-amber-900/15 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <Repeat className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-200">{missing.length} recurring bill(s) not entered for {monthLabel(month)}</p>
                  <p className="truncate text-xs text-amber-200/70">{missing.map((m) => `${m.description} (${fmtAmount(m.amount, m.currency)})`).join(' · ')}</p>
                </div>
              </div>
              <button className={btn.primary} disabled={busy} onClick={() => void addRecurring()}>Add them</button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card title={allTime ? 'By category (all time)' : 'By category'} className="self-start lg:col-span-1">
              {categories.length === 0 ? <p className="text-sm text-slate-400">Nothing spent{allTime ? '' : ' this month'}.</p> : (
                <ul className="space-y-3">
                  {categories.map((c) => (
                    <li key={c.category}>
                      <button className={`w-full text-left ${category === c.category ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`} onClick={() => setCategory(category === c.category ? '' : c.category)}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className={`truncate ${category === c.category ? 'font-semibold text-blue-200' : 'text-slate-300'}`}>{EXPENSE_CATEGORY_LABEL[c.category]}</span>
                          <span className="shrink-0 text-xs font-semibold text-white">{totalsText(c.totals)}</span>
                        </div>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#0A1628]">
                          <span className="block h-full rounded-full bg-red-500/70" style={{ width: `${Math.max(4, (((c.totals.USD ?? 0) * 300 + (c.totals.LKR ?? 0)) / maxCategory) * 100)}%` }} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-[11px] text-slate-500">Bars compare categories roughly (USD counted at ≈300 LKR). Totals are exact per currency. Click a category to filter.</p>
            </Card>

            <div className="min-w-0 lg:col-span-2">
              <div className="mb-3 flex flex-wrap gap-2">
                <input className={`${input} max-w-xs`} placeholder="Search description, paid to, reference…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className={`${input} w-auto!`} value={category} onChange={(e) => setCategory(e.target.value as '' | ExpenseCategory)}>
                  <option value="">All categories</option>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#1E3A5F]">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-[#0F1E35] text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Expense</th><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3" /></tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E3A5F]">
                    {filtered.map((e) => (
                      <tr key={e.id} className="align-top hover:bg-[#0F1E35]">
                        <td className="whitespace-nowrap px-4 py-3">{new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-3">
                          <p className="text-white">{e.description}{e.recurrence !== 'none' && <span className="ml-2 inline-flex items-center gap-0.5 rounded-full border border-amber-700/50 px-1.5 text-[10px] text-amber-300"><Repeat className="h-2.5 w-2.5" />{e.recurrence}</span>}</p>
                          <p className="text-xs text-slate-500">{[e.payee, EXPENSE_METHOD_LABEL[e.method], e.reference && `Ref ${e.reference}`].filter(Boolean).join(' · ')}</p>
                          {e.notes && <p className="text-xs text-slate-400">{e.notes}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300">{EXPENSE_CATEGORY_LABEL[e.category]}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-red-300">{fmtAmount(e.amount, e.currency)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-slate-400">
                          <button title="Edit" className="rounded p-1.5 hover:bg-slate-800 hover:text-white" onClick={() => setEditing({ id: e.id, draft: { ...e } })}><Pencil className="h-4 w-4" /></button>
                          <button title="Delete" className="rounded p-1.5 hover:bg-slate-800 hover:text-white" onClick={() => window.confirm(`Delete “${e.description}”?`) && void deleteExpense(e.id).catch((err) => setError(err.message))}><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No expenses {allTime ? 'yet' : `in ${monthLabel(month)}`}{category || q ? ' match' : ''}. Add hosting, domain, SMS and ad bills to see what FirmiCore costs to run.</td></tr>}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot className="border-t border-[#1E3A5F] bg-[#0F1E35] text-sm">
                      <tr><td className="px-4 py-3 text-slate-400" colSpan={3}>{filtered.length} shown{filtered.length !== scope.length && ` of ${scope.length}`}</td><td className="whitespace-nowrap px-4 py-3 text-right font-bold text-white">{totalsText(totalsByCurrency(filtered))}</td><td /></tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {allTime && scope.length > 0 && <p className="mt-2 text-xs text-slate-500">All time: {totalsText(scopeTotals)}</p>}
            </div>
          </div>
        </>
      )}

      {editing && d && (
        <Modal
          title={<><Wallet className="h-4 w-4 text-blue-300" /> {editing.id ? 'Edit expense' : 'Add expense'}</>}
          onClose={() => setEditing(null)}
          footer={<>
            <button className={btn.ghost} onClick={() => setEditing(null)}>Cancel</button>
            <button className={btn.primary} disabled={busy || !d.description.trim() || !(d.amount > 0)} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
          </>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Description *" className="sm:col-span-2"><input className={input} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Firebase (Blaze) — October" autoFocus /></Field>
            <Field label="Amount *">
              <div className="flex gap-2">
                <select className={`${input} w-24!`} value={d.currency} onChange={(e) => set({ currency: e.target.value as ExpenseInput['currency'] })}>
                  {EXPENSE_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className={input} type="number" min={0} step="0.01" inputMode="decimal" value={d.amount || ''} onChange={(e) => set({ amount: Number(e.target.value) || 0 })} />
              </div>
            </Field>
            <Field label="Paid on"><input className={input} type="date" value={toDateInput(d.date)} onChange={(e) => e.target.value && set({ date: fromDateInput(e.target.value) })} /></Field>
            <Field label="Category">
              <select className={input} value={d.category} onChange={(e) => set({ category: e.target.value as ExpenseCategory })}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</option>)}
              </select>
            </Field>
            <Field label="Paid to"><input className={input} value={d.payee} onChange={(e) => set({ payee: e.target.value })} placeholder="Google, Dialog, Meta, a marketer…" /></Field>
            <Field label="Payment method">
              <select className={input} value={d.method} onChange={(e) => set({ method: e.target.value as ExpenseInput['method'] })}>
                {EXPENSE_METHODS.map((m) => <option key={m} value={m}>{EXPENSE_METHOD_LABEL[m]}</option>)}
              </select>
            </Field>
            <Field label="Repeats" hint="Recurring bills are suggested again each month (or year).">
              <select className={input} value={d.recurrence} onChange={(e) => set({ recurrence: e.target.value as ExpenseInput['recurrence'] })}>
                <option value="none">One-off</option><option value="monthly">Every month</option><option value="yearly">Every year</option>
              </select>
            </Field>
            <Field label="Reference / invoice no."><input className={input} value={d.reference} onChange={(e) => set({ reference: e.target.value })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea className={input} rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
