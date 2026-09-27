import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformService, errorText, type PlatformCompany } from '@/services/platformService';
import { Badge, ErrorNote, Loading, PageHeader, PLAN_NAMES, fmtDate, input, relDays, statusTone } from './platformUi';

export default function PlatformCompaniesPage() {
  const [rows, setRows] = useState<PlatformCompany[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [cycle, setCycle] = useState('all');

  useEffect(() => {
    platformService.listCompanies().then((r) => setRows(r.companies)).catch((e) => setError(errorText(e, 'Could not load companies')));
  }, []);

  const filtered = useMemo(() => (rows ?? []).filter((c) => {
    if (status !== 'all' && c.status !== status) return false;
    if (cycle !== 'all' && (!c.hasSubscription || c.billingCycle !== cycle)) return false;
    const needle = q.trim().toLowerCase();
    return !needle || [c.name, c.adminEmail, c.adminName, c.country, c.id].some((v) => v?.toLowerCase().includes(needle));
  }), [rows, q, status, cycle]);

  return (
    <div>
      <PageHeader title="Companies" subtitle="Every registered company, its plan, billing cycle and subscription state." />
      {error && <ErrorNote message={error} />}
      <div className="mb-4 flex flex-wrap gap-3">
        <input className={`${input} max-w-xs`} placeholder="Search name, admin email, country…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${input} w-auto!`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option>
        </select>
        <select className={`${input} w-auto!`} value={cycle} onChange={(e) => setCycle(e.target.value)}>
          <option value="all">All billing</option><option value="monthly">Monthly subscribers</option><option value="yearly">Yearly subscribers</option>
        </select>
      </div>
      {!rows && !error ? <Loading /> : (
        <div className="overflow-x-auto rounded-xl border border-[#1E3A5F]">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#0F1E35] text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Company</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Access</th><th className="px-4 py-3">Subscription</th><th className="px-4 py-3">Renews / ends</th><th className="px-4 py-3">Users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[#0F1E35]">
                  <td className="px-4 py-3">
                    <Link to={`/platform/companies/${c.id}`} className="font-semibold text-blue-300! hover:underline">{c.name}</Link>
                    <p className="text-xs text-slate-500">{c.country ?? '—'} · since {fmtDate(c.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3"><p>{c.adminName ?? '—'}</p><p className="text-xs text-slate-500">{c.adminEmail ?? ''}</p></td>
                  <td className="px-4 py-3">{PLAN_NAMES[c.plan] ?? c.plan}<p className="text-xs text-slate-500">{c.hasSubscription ? c.billingCycle : 'no subscription'}</p></td>
                  <td className="px-4 py-3"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                  <td className="px-4 py-3">
                    {c.subscriptionStatus ? <Badge tone={statusTone(c.subscriptionStatus)}>{c.subscriptionStatus}</Badge> : <span className="text-slate-500">—</span>}
                    {c.cancelAtPeriodEnd && <p className="mt-1 text-xs text-amber-300">cancelling</p>}
                  </td>
                  <td className="px-4 py-3">
                    {c.status === 'trial' ? <>Trial ends {fmtDate(c.trialEndsAt)}<p className="text-xs text-slate-500">{relDays(c.trialEndsAt)}</p></>
                      : c.currentPeriodEnd ? <>{fmtDate(c.currentPeriodEnd)}<p className="text-xs text-slate-500">{relDays(c.currentPeriodEnd)}</p></> : '—'}
                  </td>
                  <td className="px-4 py-3">{c.userCount}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No companies match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
