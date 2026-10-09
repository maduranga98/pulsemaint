import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { platformService, errorText, type ApprovalStatus, type PlatformCompany } from '@/services/platformService';
import { Badge, ErrorNote, Loading, PageHeader, PLAN_NAMES, btn, fmtDate, input, relDays, statusTone } from './platformUi';
import RejectCompanyDialog from './RejectCompanyDialog';

type ApprovalFilter = 'all' | ApprovalStatus;

export default function PlatformCompaniesPage() {
  const [rows, setRows] = useState<PlatformCompany[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [cycle, setCycle] = useState('all');
  const [params, setParams] = useSearchParams();
  const approval = (['pending', 'approved', 'rejected'].includes(params.get('approval') ?? '') ? params.get('approval') : 'all') as ApprovalFilter;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PlatformCompany | null>(null);

  const load = useCallback(() => {
    platformService.listCompanies().then((r) => setRows(r.companies)).catch((e) => setError(errorText(e, 'Could not load companies')));
  }, []);
  useEffect(load, [load]);

  function setApproval(v: ApprovalFilter) {
    const next = new URLSearchParams(params);
    if (v === 'all') next.delete('approval');
    else next.set('approval', v);
    setParams(next, { replace: true });
  }

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, approved: 0, rejected: 0 };
    for (const r of rows ?? []) {
      c.all++;
      c[r.approvalStatus]++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => (rows ?? []).filter((c) => {
    if (approval !== 'all' && c.approvalStatus !== approval) return false;
    if (status !== 'all' && c.status !== status) return false;
    if (cycle !== 'all' && (!c.hasSubscription || c.billingCycle !== cycle)) return false;
    const needle = q.trim().toLowerCase();
    return !needle || [c.name, c.adminEmail, c.adminName, c.country, c.id].some((v) => v?.toLowerCase().includes(needle));
  }), [rows, q, status, cycle, approval]);

  async function decide(c: PlatformCompany, approve: boolean, reason = '') {
    setBusyId(c.id);
    setError('');
    setNotice('');
    try {
      await platformService.updateCompany(c.id, approve ? { action: 'approve' } : { action: 'reject', reason });
      setNotice(approve ? `${c.name} approved — the admin can sign in now and has been emailed.` : `${c.name} rejected. The admin has been emailed.`);
      setRejecting(null);
      load();
    } catch (e) {
      setError(errorText(e, 'Could not update the company'));
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: ApprovalFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending approval' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div>
      <PageHeader title="Companies" subtitle="Every registered company, its approval, plan, billing cycle and subscription state." />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {notice && <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-emerald-300">{notice}</div>}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setApproval(t.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${approval === t.key ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[10px] font-bold leading-4 ${t.key === 'pending' && counts.pending > 0 ? 'bg-amber-500 text-black' : 'bg-black/30'}`}>{counts[t.key]}</span>
          </button>
        ))}
      </div>

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
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-[#0F1E35] text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Company</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Approval</th><th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Access</th><th className="px-4 py-3">Subscription</th><th className="px-4 py-3">Renews / ends</th><th className="px-4 py-3">Users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]">
              {filtered.map((c) => (
                <tr key={c.id} className={`hover:bg-[#0F1E35] ${c.approvalStatus === 'pending' ? 'bg-amber-950/10' : ''}`}>
                  <td className="px-4 py-3">
                    <Link to={`/platform/companies/${c.id}`} className="font-semibold text-blue-300! hover:underline">{c.name}</Link>
                    <p className="text-xs text-slate-500">{c.industry ?? '—'} · {c.country ?? '—'} · registered {fmtDate(c.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3"><p>{c.adminName ?? '—'}</p><p className="text-xs text-slate-500">{c.adminEmail ?? ''}</p></td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(c.approvalStatus)}>{c.approvalStatus}</Badge>
                    {c.approvalStatus === 'pending' && (
                      <div className="mt-2 flex gap-1.5">
                        <button className={`${btn.primary} inline-flex items-center gap-1 px-2! py-1! text-xs!`} disabled={busyId !== null} onClick={() => void decide(c, true)}>
                          <Check className="h-3.5 w-3.5" /> {busyId === c.id ? '…' : 'Approve'}
                        </button>
                        <button className={`${btn.danger} inline-flex items-center gap-1 px-2! py-1! text-xs!`} disabled={busyId !== null} onClick={() => setRejecting(c)}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    )}
                    {c.approvalStatus === 'rejected' && c.rejectionReason && <p className="mt-1 max-w-[180px] truncate text-xs text-slate-500" title={c.rejectionReason}>{c.rejectionReason}</p>}
                  </td>
                  <td className="px-4 py-3">{PLAN_NAMES[c.plan] ?? c.plan}<p className="text-xs text-slate-500">{c.hasSubscription ? c.billingCycle : 'no subscription'}</p></td>
                  <td className="px-4 py-3"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                  <td className="px-4 py-3">
                    {c.subscriptionStatus ? <Badge tone={statusTone(c.subscriptionStatus)}>{c.subscriptionStatus}</Badge> : <span className="text-slate-500">—</span>}
                    {c.cancelAtPeriodEnd && <p className="mt-1 text-xs text-amber-300">cancelling</p>}
                  </td>
                  <td className="px-4 py-3">
                    {c.approvalStatus !== 'approved' ? <span className="text-slate-500">—</span>
                      : c.status === 'trial' ? <>Trial ends {fmtDate(c.trialEndsAt)}<p className="text-xs text-slate-500">{relDays(c.trialEndsAt)}</p></>
                      : c.currentPeriodEnd ? <>{fmtDate(c.currentPeriodEnd)}<p className="text-xs text-slate-500">{relDays(c.currentPeriodEnd)}</p></> : '—'}
                  </td>
                  <td className="px-4 py-3">{c.userCount}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{approval === 'pending' ? 'No registrations are waiting for approval.' : 'No companies match.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {rejecting && (
        <RejectCompanyDialog
          companyName={rejecting.name}
          busy={busyId !== null}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => void decide(rejecting, false, reason)}
        />
      )}
    </div>
  );
}
