import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { platformService, errorText, type PlatformPayment } from '@/services/platformService';
import { markPaymentAlertsRead, type PaymentAlert } from '@/lib/platform/usePaymentAlerts';
import { ErrorNote, Loading, PageHeader, Stat, fmtDate, fmtMoney } from './platformUi';

/** FirmiCore CMMS payments received (paid invoices for FirmiCore plans only). */
export default function PlatformPaymentsPage() {
  const ctx = useOutletContext<{ paymentAlerts: PaymentAlert[] } | undefined>();
  const paymentAlerts = ctx?.paymentAlerts ?? [];
  const [rows, setRows] = useState<PlatformPayment[] | null>(null);
  const [error, setError] = useState('');
  const alertIds = paymentAlerts.map((a) => a.id).join(',');

  // Reload when a new payment arrives while the page is open.
  useEffect(() => {
    platformService.listPayments().then((r) => setRows(r.payments)).catch((e) => setError(errorText(e, 'Could not load payments')));
  }, [alertIds]);

  // Viewing the page clears the "payment received" badge.
  useEffect(() => {
    if (alertIds) void markPaymentAlertsRead(alertIds.split(','));
  }, [alertIds]);

  const now = Date.now();
  const sum = (from: number) => (rows ?? []).filter((p) => p.created >= from).reduce((s, p) => s + p.amountPaid, 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  return (
    <div>
      <PageHeader
        title="Payments received"
        subtitle="FirmiCore CMMS only — paid invoices for FirmiCore plans (latest 100). Payments for other Lumora Ventures products on the same Stripe account are excluded."
      />
      {error && <ErrorNote message={error} />}
      {!rows && !error ? <Loading /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="This month" value={fmtMoney(sum(monthStart))} tone="green" />
            <Stat label="Last 30 days" value={fmtMoney(sum(now - 30 * 86_400_000))} tone="green" />
            <Stat label="Last 12 months" value={fmtMoney(sum(now - 365 * 86_400_000))} />
            <Stat label="Payments shown" value={rows?.length ?? 0} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#1E3A5F]">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[#0F1E35] text-left text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="px-4 py-3">Paid on</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3 text-right">Amount received</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-[#1E3A5F]">
                {(rows ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{fmtDate(p.created)}<p className="text-xs text-slate-500">{p.number ?? p.id}</p></td>
                    <td className="px-4 py-3">{p.companyId ? <Link to={`/platform/companies/${p.companyId}`} className="text-blue-300! hover:underline">{p.companyName ?? p.companyId}</Link> : (p.companyName ?? '—')}</td>
                    <td className="px-4 py-3 text-slate-300">{p.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-300 tabular-nums">{fmtMoney(p.amountPaid, p.currency)}</td>
                    <td className="px-4 py-3">{p.hostedInvoiceUrl && <a href={p.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-blue-300! hover:underline">Invoice</a>}</td>
                  </tr>
                ))}
                {(rows ?? []).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No FirmiCore payments received yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
