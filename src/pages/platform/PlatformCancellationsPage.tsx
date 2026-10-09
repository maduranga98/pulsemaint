import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, LogOut, RotateCcw, XCircle } from 'lucide-react';
import { CANCELLATION_REASON_LABEL } from '@/lib/cancellation';
import { setCancellationHandled, subscribeCancellations, type PlatformCancellation } from '@/services/platformCancellationsService';
import { Badge, Card, ErrorNote, Loading, PageHeader, PLAN_NAMES, btn, fmtDate, fmtDateTime, input } from './platformUi';

type KindFilter = 'all' | PlatformCancellation['kind'];

/** Companies that cancelled their subscription or asked to leave FirmiCore, with the reason they gave. */
export default function PlatformCancellationsPage() {
  const [rows, setRows] = useState<PlatformCancellation[] | null>(null);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [status, setStatus] = useState<'open' | 'handled' | 'all'>('open');
  const [q, setQ] = useState('');

  useEffect(() => subscribeCancellations(setRows, (e) => setError(e.message)), []);

  const filtered = useMemo(() => (rows ?? []).filter((r) => {
    if (kind !== 'all' && r.kind !== kind) return false;
    if (status !== 'all' && r.status !== status) return false;
    const n = q.trim().toLowerCase();
    return !n || [r.companyName, r.details, r.requestedByEmail, r.reason && CANCELLATION_REASON_LABEL[r.reason]].some((v) => v?.toLowerCase().includes(n));
  }), [rows, kind, status, q]);

  const reasonStats = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.reason) m.set(r.reason, (m.get(r.reason) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const total = rows?.length ?? 0;
  const leaves = (rows ?? []).filter((r) => r.kind === 'leave_system').length;

  async function toggle(r: PlatformCancellation) {
    const note = r.status === 'open' ? window.prompt('Note (optional) — e.g. called them, offered a discount, account closed:', '') : '';
    if (note === null) return;
    await setCancellationHandled(r.id, r.status === 'open', note).catch((e) => setError(e.message));
  }

  return (
    <div>
      <PageHeader title="Cancellations" subtitle="Companies that cancelled their subscription or asked to leave FirmiCore, with the reason they had to give. Mark each one handled after following up." />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}

      {total > 0 && (
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card title="Total">
            <p className="text-3xl font-bold text-white">{total}</p>
            <p className="text-xs text-slate-500">{total - leaves} subscription cancellations · {leaves} leave requests</p>
          </Card>
          <Card title="Top reasons" className="lg:col-span-2">
            <ul className="space-y-1.5">
              {reasonStats.slice(0, 5).map(([reason, n]) => (
                <li key={reason} className="flex items-center gap-3 text-sm">
                  <span className="w-52 shrink-0 truncate text-slate-300">{CANCELLATION_REASON_LABEL[reason] ?? reason}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#0A1628]"><span className="block h-full rounded-full bg-red-500/70" style={{ width: `${(n / total) * 100}%` }} /></span>
                  <span className="w-8 text-right font-semibold text-white">{n}</span>
                </li>
              ))}
              {reasonStats.length === 0 && <li className="text-sm text-slate-400">No reasons yet.</li>}
            </ul>
          </Card>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input className={`${input} max-w-xs`} placeholder="Search company, reason, details…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${input} w-auto!`} value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
          <option value="all">Cancellations & leave requests</option><option value="cancel_subscription">Subscription cancellations</option><option value="leave_system">Requests to leave</option>
        </select>
        <select className={`${input} w-auto!`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="open">Open</option><option value="handled">Handled</option><option value="all">All</option>
        </select>
      </div>

      {!rows && !error ? <Loading /> : (
        <div className="overflow-x-auto rounded-xl border border-[#1E3A5F]">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-[#0F1E35] text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Plan · access ends</th><th className="px-4 py-3">Requested by</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]">
              {filtered.map((r) => (
                <tr key={r.id} className="align-top hover:bg-[#0F1E35]">
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3"><Link to={`/platform/companies/${r.companyId}`} className="font-semibold text-blue-300! hover:underline">{r.companyName ?? r.companyId}</Link></td>
                  <td className="px-4 py-3">
                    {r.kind === 'leave_system'
                      ? <span className="inline-flex items-center gap-1 text-red-300"><LogOut className="h-3.5 w-3.5" /> Leave FirmiCore</span>
                      : <span className="inline-flex items-center gap-1 text-amber-300"><XCircle className="h-3.5 w-3.5" /> Cancel subscription</span>}
                    <p className="text-xs text-slate-500">{r.source === 'stripe_portal' ? 'via Stripe portal' : 'in the app'}</p>
                  </td>
                  <td className="max-w-[320px] px-4 py-3">
                    {r.reasonPending ? <Badge tone="amber">waiting for reason</Badge> : <p className="text-white">{r.reason ? CANCELLATION_REASON_LABEL[r.reason] ?? r.reason : '—'}</p>}
                    {r.details && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-400">{r.details}</p>}
                  </td>
                  <td className="px-4 py-3">{r.plan ? `${PLAN_NAMES[r.plan] ?? r.plan} · ${r.billingCycle ?? ''}` : '—'}<p className="text-xs text-slate-500">{r.endsAt ? `ends ${fmtDate(r.endsAt)}` : r.hadSubscription ? '' : 'no subscription'}</p></td>
                  <td className="px-4 py-3">{r.requestedByName ?? '—'}<p className="text-xs text-slate-500">{r.requestedByEmail ?? ''}</p></td>
                  <td className="px-4 py-3">
                    <button className={`${btn.ghost} inline-flex items-center gap-1 px-2! py-1! text-xs!`} onClick={() => void toggle(r)}>
                      {r.status === 'open' ? <><CheckCircle2 className="h-3.5 w-3.5" /> Mark handled</> : <><RotateCcw className="h-3.5 w-3.5" /> Reopen</>}
                    </button>
                    {r.status === 'handled' && r.handledNote && <p className="mt-1 max-w-[200px] text-xs text-slate-500">{r.handledNote}</p>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{status === 'open' ? 'No open cancellations.' : 'Nothing matches.'}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
