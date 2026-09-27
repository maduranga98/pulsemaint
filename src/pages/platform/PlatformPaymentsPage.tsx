import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { platformService, errorText, type PlatformPayment } from '@/services/platformService';
import { markPaymentAlertsRead, type PaymentAlert } from '@/lib/platform/usePaymentAlerts';
import { ErrorNote, Loading, PageHeader, Stat, PLAN_NAMES, fmtDate, fmtMoney } from './platformUi';

type CycleFilter = 'all' | 'monthly' | 'yearly';

const FILTERS: { id: CycleFilter; label: string }[] = [
  { id: 'all', label: 'All payments' },
  { id: 'monthly', label: 'Monthly subscriptions' },
  { id: 'yearly', label: 'Yearly subscriptions' },
];

/** FirmiCore CMMS payments received (paid invoices for FirmiCore plans only). */
export default function PlatformPaymentsPage() {
  const ctx = useOutletContext<{ paymentAlerts: PaymentAlert[] } | undefined>();
  const paymentAlerts = ctx?.paymentAlerts ?? [];
  const [rows, setRows] = useState<PlatformPayment[] | null>(null);
  const [error, setError] = useState('');
  const [cycle, setCycle] = useState<CycleFilter>('all');
  const alertIds = paymentAlerts.map((a) => a.id).join(',');

  // Reload when a new payment arrives while the page is open.
  useEffect(() => {
    platformService.listPayments().then((r) => setRows(r.payments)).catch((e) => setError(errorText(e, 'Could not load payments')));
  }, [alertIds]);

  // Viewing the page clears the "payment received" badge.
  useEffect(() => {
    if (alertIds) void markPaymentAlertsRead(alertIds.split(','));
  }, [alertIds]);

  const filtered = useMemo(() => (rows ?? []).filter((p) => cycle === 'all' || p.billingCycle === cycle), [rows, cycle]);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const thisMonth = filtered.filter((p) => p.created >= monthStart);
  const total = (list: PlatformPayment[]) => list.reduce((s, p) => s + p.amountPaid, 0);
  const countFor = (c: CycleFilter) => (rows ?? []).filter((p) => c === 'all' || p.billingCycle === c).length;
  const monthName = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader
        title="Payments received"
        subtitle="FirmiCore CMMS only — paid invoices for FirmiCore plans. Payments for other Lumora Ventures products on the same Stripe account are excluded."
      />
      {error && <ErrorNote message={error} />}
      {!rows && !error ? <Loading /> : (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={cycle === f.id}
                onClick={() => setCycle(f.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${cycle === f.id ? 'bg-blue-600 text-white' : 'border border-[#1E3A5F] bg-[#0F1E35] text-slate-300 hover:text-white'}`}
              >
                {f.label} <span className="ml-1 text-xs opacity-80">({countFor(f.id)})</span>
              </button>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total received" value={fmtMoney(total(filtered))} tone="green" hint={FILTERS.find((f) => f.id === cycle)?.label} />
            <Stat label="Received this month" value={fmtMoney(total(thisMonth))} tone="green" hint={monthName} />
            <Stat label="Total no. of payments" value={filtered.length} />
            <Stat label="Payments this month" value={thisMonth.length} hint={monthName} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#1E3A5F]">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#0F1E35] text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Paid on</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Billing</th><th className="px-4 py-3 text-right">Amount received</th><th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E3A5F]">
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{fmtDate(p.created)}<p className="text-xs text-slate-500">{p.number ?? p.id}</p></td>
                    <td className="px-4 py-3">{p.companyId ? <Link to={`/platform/companies/${p.companyId}`} className="text-blue-300! hover:underline">{p.companyName ?? p.companyId}</Link> : (p.companyName ?? '—')}</td>
                    <td className="px-4 py-3 text-slate-300">{PLAN_NAMES[p.plan] ?? p.plan}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase ${p.billingCycle === 'yearly' ? 'border-violet-700/50 bg-violet-900/30 text-violet-300' : 'border-blue-700/50 bg-blue-900/30 text-blue-300'}`}>
                        {p.billingCycle}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-300 tabular-nums">{fmtMoney(p.amountPaid, p.currency)}</td>
                    <td className="px-4 py-3">{p.hostedInvoiceUrl && <a href={p.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-blue-300! hover:underline">Invoice</a>}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No FirmiCore payments received{cycle !== 'all' ? ` for ${cycle} subscriptions` : ''} yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
