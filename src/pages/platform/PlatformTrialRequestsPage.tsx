import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { countryLabel } from '@/lib/countries';
import { platformService, errorText, type ApprovalStatus, type PlatformCompany } from '@/services/platformService';
import { Badge, Card, ErrorNote, Loading, PageHeader, btn, fmtDate, input, relDays, statusTone } from './platformUi';
import RejectCompanyDialog from './RejectCompanyDialog';

const TABS: { key: ApprovalStatus; label: string }[] = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

/**
 * Companies that registered for a free trial. A new registration cannot use
 * FirmiCore until it is approved here; approving starts its 14-day trial and
 * emails the admin, rejecting emails them the reason.
 */
export default function PlatformTrialRequestsPage() {
  const [rows, setRows] = useState<PlatformCompany[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<ApprovalStatus>('pending');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PlatformCompany | null>(null);

  const load = useCallback(() => {
    platformService.listCompanies().then((r) => setRows(r.companies)).catch((e) => setError(errorText(e, 'Could not load trial requests')));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => {
    const c: Record<ApprovalStatus, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const r of rows ?? []) c[r.approvalStatus]++;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? [])
      .filter((c) => c.approvalStatus === tab)
      .filter((c) => !needle || [c.name, c.adminName, c.adminEmail, c.country, countryLabel(c.country), c.industry].some((v) => v?.toLowerCase().includes(needle)))
      // Waiting requests: oldest first, so nobody is left waiting. Decided ones: newest first.
      .sort((a, b) => (tab === 'pending' ? (a.createdAt ?? 0) - (b.createdAt ?? 0) : (b.createdAt ?? 0) - (a.createdAt ?? 0)));
  }, [rows, tab, q]);

  async function decide(c: PlatformCompany, approve: boolean, reason = '') {
    setBusyId(c.id);
    setError('');
    setNotice('');
    try {
      await platformService.updateCompany(c.id, approve ? { action: 'approve' } : { action: 'reject', reason });
      setNotice(approve ? `${c.name} approved — their 14-day trial has started and the admin has been emailed.` : `${c.name} rejected. The admin has been emailed.`);
      setRejecting(null);
      load();
    } catch (e) {
      setError(errorText(e, 'Could not update the request'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Trial requests" subtitle="Companies asking to start a free trial. Approve a request to start its 14-day trial, or reject it." />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {notice && <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-emerald-300">{notice}</div>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${tab === t.key ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-[10px] font-bold leading-4 ${t.key === 'pending' && counts.pending > 0 ? 'bg-amber-500 text-black' : 'bg-black/30'}`}>{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <input className={`${input} max-w-xs`} placeholder="Search company, admin, country…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!rows ? <Loading /> : shown.length === 0 ? (
        <Card><p className="text-sm text-slate-400">{tab === 'pending' ? 'No trial requests are waiting.' : `No ${tab} requests.`}</p></Card>
      ) : (
        <div className="grid gap-3">
          {shown.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/platform/companies/${c.id}`} className="text-base font-semibold text-blue-300! hover:underline">{c.name}</Link>
                    <Badge tone={statusTone(c.approvalStatus)}>{c.approvalStatus}</Badge>
                  </div>
                  <p className="text-sm text-slate-300">{[c.industry, countryLabel(c.country)].filter(Boolean).join(' · ') || '—'}</p>
                  <p className="text-sm text-slate-300">
                    {c.adminName ?? '—'}{c.adminEmail ? <> · <a href={`mailto:${c.adminEmail}`} className="text-blue-300! hover:underline">{c.adminEmail}</a></> : null}
                  </p>
                  <p className="text-xs text-slate-500">Requested {fmtDate(c.createdAt)} ({relDays(c.createdAt)}) · {c.userCount} user{c.userCount === 1 ? '' : 's'}</p>
                  {c.approvalStatus === 'approved' && c.status === 'trial' && <p className="text-xs text-slate-400">Trial ends {fmtDate(c.trialEndsAt)} ({relDays(c.trialEndsAt)})</p>}
                  {c.approvalStatus === 'rejected' && c.rejectionReason && <p className="text-xs text-red-300">Reason: {c.rejectionReason}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {c.approvalStatus !== 'approved' && (
                    <button className={btn.primary} disabled={busyId === c.id} onClick={() => void decide(c, true)}><Check className="mr-1 inline h-4 w-4" />Approve &amp; start trial</button>
                  )}
                  {c.approvalStatus !== 'rejected' && (
                    <button className={btn.danger} disabled={busyId === c.id} onClick={() => setRejecting(c)}><X className="mr-1 inline h-4 w-4" />Reject</button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {rejecting && (
        <RejectCompanyDialog
          companyName={rejecting.name}
          busy={busyId === rejecting.id}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => void decide(rejecting, false, reason)}
        />
      )}
    </div>
  );
}
