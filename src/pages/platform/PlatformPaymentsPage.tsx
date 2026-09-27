import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformService, errorText, type PlatformPayment } from '@/services/platformService';
import { Badge, ErrorNote, Loading, PageHeader, Stat, fmtDate, fmtMoney, input, statusTone } from './platformUi';

export default function PlatformPaymentsPage() {
  const [rows, setRows] = useState<PlatformPayment[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    platformService.listPayments().then((r) => setRows(r.payments)).catch((e) => setError(errorText(e, 'Could not load payments')));
  }, []);

  const filtered = useMemo(() => (rows ?? []).filter((p) => status === 'all' || p.status === status), [rows, status]);
  const collected30 = (rows ?? []).filter((p) => p.status === 'paid' && p.created > Date.now() - 30 * 86_400_000).reduce((s, p) => s + p.amountPaid, 0);
  const outstanding = (rows ?? []).filter((p) => p.status === 'open').reduce((s, p) => s + p.amountDue, 0);

  return (
    <div>
      <PageHeader title="Payments" subtitle="FirmiCore CMMS subscription invoices only (latest 100) — other Lumora Ventures products on the same Stripe account are excluded." />
      {error && <ErrorNote message={error} />}
      {!rows && !error ? <Loading /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Collected, last 30 days" value={fmtMoney(collected30)} tone="green" />
            <Stat label="Outstanding (open)" value={fmtMoney(outstanding)} tone={outstanding ? 'red' : undefined} />
            <Stat label="Invoices shown" value={rows?.length ?? 0} />
          </div>
          <select className={`${input} mb-4 w-auto!`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option><option value="paid">Paid</option><option value="open">Open / failed</option>
            <option value="uncollectible">Uncollectible</option><option value="void">Void</option>
          </select>
          <div className="overflow-x-auto rounded-xl border border-[#1E3A5F]">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#0F1E35] text-left text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-[#1E3A5F]">
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{fmtDate(p.created)}<p className="text-xs text-slate-500">{p.number ?? p.id}</p></td>
                    <td className="px-4 py-3">{p.companyId ? <Link to={`/platform/companies/${p.companyId}`} className="text-blue-300! hover:underline">{p.companyName ?? p.companyId}</Link> : (p.companyName ?? '—')}</td>
                    <td className="px-4 py-3 text-slate-300">{p.description ?? '—'}</td>
                    <td className="px-4 py-3">{fmtMoney(p.total, p.currency)}{p.status === 'open' && p.amountDue > 0 && <p className="text-xs text-red-300">due {fmtMoney(p.amountDue, p.currency)}</p>}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone(p.status)}>{p.status}</Badge>{p.attemptCount > 1 && <p className="text-xs text-slate-500">{p.attemptCount} attempts{p.nextAttempt ? `, next ${fmtDate(p.nextAttempt)}` : ''}</p>}</td>
                    <td className="px-4 py-3">{p.hostedInvoiceUrl && <a href={p.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-blue-300! hover:underline">Invoice</a>}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No payments.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
