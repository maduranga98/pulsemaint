import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, UserPlus, X } from 'lucide-react';
import { countryLabel } from '@/lib/countries';
import { findLeadForTrialRequest, trialRequestToLeadInput, type Lead, type TeamMember } from '@/lib/platform/leads';
import { addLeadNote, createLead, updateLead } from '@/services/platformLeadsService';
import { platformService, errorText, type ApprovalStatus, type PlatformCompany } from '@/services/platformService';
import { Badge, ErrorNote, btn, fmtDate, input, relDays, statusTone } from '../platformUi';
import RejectCompanyDialog from '../RejectCompanyDialog';
import { StatusPill } from './leadUi';

const TABS: { key: ApprovalStatus; label: string }[] = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

/**
 * Companies that registered for a free trial, worked like leads: each request
 * shows the lead it belongs to (or can become one), and approving or rejecting
 * it is logged on that lead. Approving starts the company's 14-day trial and
 * emails its admin; rejecting emails them the reason.
 */
export default function TrialRequestsView({ requests, leads, team, onReload, onOpenLead, onNotice }: {
  requests: PlatformCompany[] | null;
  leads: Lead[];
  team: TeamMember[];
  onReload: () => void;
  onOpenLead: (id: string) => void;
  onNotice: (msg: string) => void;
}) {
  const [tab, setTab] = useState<ApprovalStatus>('pending');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<PlatformCompany | null>(null);

  const counts = useMemo(() => {
    const c: Record<ApprovalStatus, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const r of requests ?? []) c[r.approvalStatus]++;
    return c;
  }, [requests]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (requests ?? [])
      .filter((c) => c.approvalStatus === tab)
      .filter((c) => !needle || [c.name, c.adminName, c.adminEmail, c.country, countryLabel(c.country), c.industry].some((v) => v?.toLowerCase().includes(needle)))
      // Waiting: oldest first so nobody is left waiting. Decided: newest first.
      .sort((a, b) => (tab === 'pending' ? (a.createdAt ?? 0) - (b.createdAt ?? 0) : (b.createdAt ?? 0) - (a.createdAt ?? 0)));
  }, [requests, tab, q]);

  const ownerName = (id: string | null) => team.find((m) => m.id === id)?.name ?? '';

  async function decide(c: PlatformCompany, approve: boolean, reason = '') {
    setBusyId(c.id);
    setError('');
    try {
      await platformService.updateCompany(c.id, approve ? { action: 'approve' } : { action: 'reject', reason });
      const lead = findLeadForTrialRequest(c, leads);
      if (lead) {
        // Keep the lead in step: link it to the company and log the decision.
        if (!lead.companyId) await updateLead(lead, { companyId: c.id }).catch(() => {});
        await addLeadNote(lead, approve ? 'Trial approved — the 14-day trial has started.' : `Trial request rejected${reason ? `: ${reason}` : '.'}`).catch(() => {});
      }
      onNotice(approve ? `${c.name} approved — their 14-day trial has started and the admin has been emailed.` : `${c.name} rejected. The admin has been emailed.`);
      setRejecting(null);
      onReload();
    } catch (e) {
      setError(errorText(e, 'Could not update the request'));
    } finally {
      setBusyId(null);
    }
  }

  async function addAsLead(c: PlatformCompany) {
    setBusyId(c.id);
    setError('');
    try {
      const id = await createLead(trialRequestToLeadInput(c));
      onOpenLead(id);
    } catch (e) {
      setError(errorText(e, 'Could not create the lead'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <p className="mb-3 text-sm text-slate-400">Companies asking to start a free trial. Approve a request to start its 14-day trial, or reject it. Each request is matched to its lead, or can be added as one.</p>
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

      {!requests ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-6 text-sm text-slate-400">{tab === 'pending' ? 'No trial requests are waiting.' : `No ${tab} requests.`}</p>
      ) : (
        <div className="grid gap-3">
          {shown.map((c) => {
            const lead = findLeadForTrialRequest(c, leads);
            return (
              <div key={c.id} className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
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
                    <p className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
                      Lead:{' '}
                      {lead ? (
                        <>
                          <button className="inline-flex items-center gap-1 text-blue-300 hover:underline" onClick={() => onOpenLead(lead.id)}>{lead.businessName}<ExternalLink className="h-3 w-3" /></button>
                          <StatusPill status={lead.status} />
                          {ownerName(lead.assignedTo) && <span>· {ownerName(lead.assignedTo)}</span>}
                        </>
                      ) : <span className="text-slate-500">none yet</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!lead && (
                      <button className={btn.ghost} disabled={busyId === c.id} onClick={() => void addAsLead(c)}><UserPlus className="mr-1 inline h-4 w-4" />Add as lead</button>
                    )}
                    {c.approvalStatus !== 'approved' && (
                      <button className={btn.primary} disabled={busyId === c.id} onClick={() => void decide(c, true)}><Check className="mr-1 inline h-4 w-4" />Approve &amp; start trial</button>
                    )}
                    {c.approvalStatus !== 'rejected' && (
                      <button className={btn.danger} disabled={busyId === c.id} onClick={() => setRejecting(c)}><X className="mr-1 inline h-4 w-4" />Reject</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
