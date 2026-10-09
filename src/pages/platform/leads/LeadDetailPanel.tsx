import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive, ArchiveRestore, Bug, Building2, CalendarClock, History, Mail, MapPin, MessageCircle, Pencil, Phone, PhoneCall,
  StickyNote, Trash2, Wallet, X,
} from 'lucide-react';
import {
  CALL_OUTCOMES, CALL_OUTCOME_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, activityOutcomeLabel, activityTypeLabel, fmtAmount, whatsappNumber,
  type CallOutcome, type Lead, type LeadActivity, type LeadStatus, type TeamMember,
} from '@/lib/platform/leads';
import {
  addLeadNote, bookDemo, clearNextCall, createFeatureRequest, deleteLead, logCall, markDemoDone, setArchived, setLeadStatus,
  subscribeLeadActivities, updateLead,
} from '@/services/platformLeadsService';
import { platformService, type PlatformCompany } from '@/services/platformService';
import { ErrorNote, btn, fmtDateTime, input } from '../platformUi';
import { StatusPill, TagChip, fromLocalInput, toLocalInput, whenLabel } from './leadUi';

type Panel = 'call' | 'note' | 'demo' | 'issue' | null;

/** Right-hand drawer for one lead: contact actions, call logging, notes, demo, history. */
export default function LeadDetailPanel({ lead, team, onClose, onEdit }: {
  lead: Lead; team: TeamMember[]; onClose: () => void; onEdit: () => void;
}) {
  const [history, setHistory] = useState<LeadActivity[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [panel, setPanel] = useState<Panel>('call');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Call form
  const [outcome, setOutcome] = useState<CallOutcome>('spoke');
  const [callNote, setCallNote] = useState('');
  const [nextCall, setNextCall] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  // Note / demo / issue forms
  const [note, setNote] = useState('');
  const [demoAt, setDemoAt] = useState(toLocalInput(lead.demoAt));
  const [demoNote, setDemoNote] = useState('');
  const [issueType, setIssueType] = useState<'feature' | 'bug'>('feature');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueBody, setIssueBody] = useState('');
  // Company link
  const [companies, setCompanies] = useState<PlatformCompany[] | null>(null);

  useEffect(() => subscribeLeadActivities(lead.id, setHistory, (e) => setError(e.message)), [lead.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError('');
    try {
      await fn();
      after?.();
    } catch (e) {
      setError((e as Error).message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const member = (id: string | null) => team.find((m) => m.id === id);
  const wa = whatsappNumber(lead.phone);
  const company = companies?.find((c) => c.id === lead.companyId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {showHistory && (
        <aside className="hidden w-[380px] flex-col border-l border-[#1E3A5F] bg-[#0B1A2E] md:flex">
          <div className="flex items-center justify-between border-b border-[#1E3A5F] px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><History className="h-4 w-4 text-amber-300" /> History ({history.length})</p>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white" aria-label="Hide history"><X className="h-4 w-4" /></button>
          </div>
          <HistoryList rows={history} />
        </aside>
      )}
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-[#1E3A5F] bg-[#0F1E35]">
        <div className="flex items-start gap-3 border-b border-[#1E3A5F] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-white!">{lead.businessName}</h2>
            {lead.contactPerson && <p className="text-sm text-slate-400">{lead.contactPerson}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusPill status={lead.status} />
              {lead.archived && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] text-slate-300">Archived</span>}
              {lead.tags.map((t) => <TagChip key={t} tag={t} />)}
            </div>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <IconBtn title="History" active={showHistory} onClick={() => setShowHistory((v) => !v)}><History className="h-4 w-4" /></IconBtn>
            <IconBtn title="Edit" onClick={onEdit}><Pencil className="h-4 w-4" /></IconBtn>
            <IconBtn title={lead.archived ? 'Restore' : 'Archive'} onClick={() => void run(() => setArchived(lead.id, !lead.archived))}>
              {lead.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </IconBtn>
            <IconBtn title="Delete permanently" onClick={() => {
              if (window.confirm(`Delete “${lead.businessName}” and its whole history? This cannot be undone.`)) void run(() => deleteLead(lead.id), onClose);
            }}><Trash2 className="h-4 w-4" /></IconBtn>
            <IconBtn title="Close" onClick={onClose}><X className="h-5 w-5" /></IconBtn>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && <ErrorNote message={error} />}

          {/* Contact */}
          <div className="space-y-2 text-sm">
            {lead.phone && (
              <div className="flex flex-wrap items-center gap-2">
                <Phone className="h-4 w-4 text-slate-500" /><span className="text-white">{lead.phone}</span>
                <a href={`tel:${lead.phone.replace(/\s/g, '')}`} className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-200 hover:bg-slate-800">Call</a>
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-emerald-700/60 px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-900/30"><MessageCircle className="h-3 w-3" /> WhatsApp</a>}
              </div>
            )}
            {lead.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" /><a href={`mailto:${lead.email}`} className="text-blue-300!">{lead.email}</a></p>}
            {(lead.location || lead.district) && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-500" />{[lead.location, lead.district].filter(Boolean).join(', ')}</p>}
            {(lead.source || lead.campaign) && <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-500" />via {[lead.source, lead.campaign].filter(Boolean).join(' · ')}{lead.industry && <span className="text-slate-500">· {lead.industry}</span>}</p>}
            {lead.closedAmount > 0 && <p className="flex items-center gap-2"><Wallet className="h-4 w-4 text-slate-500" />{fmtAmount(lead.closedAmount, lead.currency)}</p>}
            {lead.priceQuoted && <p className="text-slate-400">Price told: <span className="text-slate-200">{lead.priceQuoted}</span></p>}
            {lead.mainProblem && <p className="text-slate-400">Main problem: <span className="text-slate-200">{lead.mainProblem}</span></p>}
            {lead.demoRequested && <p className="text-violet-300">They've asked for a demo.</p>}
            {lead.notes && <p className="whitespace-pre-wrap rounded-lg bg-[#0A1628] p-3 text-slate-300">{lead.notes}</p>}
          </div>

          {/* Status / owner */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Status</span>
              <select className={input} value={lead.status} disabled={busy} onChange={(e) => void run(() => setLeadStatus(lead, e.target.value as LeadStatus))}>
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Assigned to</span>
              <select className={input} value={lead.assignedTo ?? ''} disabled={busy} onChange={(e) => void run(() => updateLead(lead, { assignedTo: e.target.value || null }))}>
                <option value="">— Unassigned</option>
                {team.filter((m) => m.active || m.id === lead.assignedTo).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Calls made: <span className="text-slate-300">{lead.callsMade}</span>
              {lead.marketerId && <> · Brought in by <span className="text-slate-300">{member(lead.marketerId)?.name ?? 'removed member'}</span></>}
              {lead.createdByEmail && <> · Added by {lead.createdByEmail}</>}
            </p>
          </div>

          {/* Next call + demo summary */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-300"><PhoneCall className="h-3.5 w-3.5" /> Next call</p>
              {lead.nextCallAt ? (
                <>
                  <p className={`mt-1 text-sm ${lead.nextCallAt < Date.now() ? 'text-red-300' : 'text-white'}`}>{fmtDateTime(lead.nextCallAt)} <span className="text-xs text-slate-500">{whenLabel(lead.nextCallAt)}</span></p>
                  {lead.followUpNote && <p className="text-xs text-slate-400">{lead.followUpNote}</p>}
                  <button className="mt-1 text-xs text-slate-400 hover:text-white" onClick={() => void run(() => clearNextCall(lead.id))}>Clear</button>
                </>
              ) : <p className="mt-1 text-sm text-slate-500">None booked.</p>}
            </div>
            <div className="rounded-lg border border-violet-800/50 bg-violet-950/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-300"><CalendarClock className="h-3.5 w-3.5" /> Demo</p>
              {lead.demoAt ? <p className="mt-1 text-sm text-white">{fmtDateTime(lead.demoAt)} <span className="text-xs text-slate-500">{whenLabel(lead.demoAt)}</span></p> : <p className="mt-1 text-sm text-slate-500">Not booked yet.</p>}
              {lead.status === 'demo_booked' && <button className="mt-1 text-xs text-violet-300 hover:text-white" disabled={busy} onClick={() => void run(() => markDemoDone(lead, ''))}>Mark demo done</button>}
            </div>
          </div>

          {/* Company link */}
          <div className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3 text-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><Building2 className="h-3.5 w-3.5" /> FirmiCore company</p>
            {lead.companyId ? (
              <p className="mt-1">
                <Link to={`/platform/companies/${lead.companyId}`} className="text-blue-300! hover:underline">{company?.name ?? 'Open company'}</Link>
                <button className="ml-3 text-xs text-slate-400 hover:text-white" onClick={() => void run(() => updateLead(lead, { companyId: null }))}>Unlink</button>
              </p>
            ) : companies ? (
              <select className={`${input} mt-1`} defaultValue="" onChange={(e) => e.target.value && void run(() => updateLead(lead, { companyId: e.target.value }))}>
                <option value="">Link the company they signed up as…</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.adminEmail ? ` — ${c.adminEmail}` : ''}</option>)}
              </select>
            ) : (
              <button className="mt-1 text-xs text-blue-300 hover:underline" onClick={() => void platformService.listCompanies().then((r) => setCompanies(r.companies)).catch((e) => setError(e.message))}>
                Link to a signed-up company…
              </button>
            )}
          </div>

          {/* Action tabs */}
          <div>
            <div className="flex flex-wrap gap-1.5">
              <TabBtn on={panel === 'call'} onClick={() => setPanel('call')}><PhoneCall className="h-3.5 w-3.5" /> Log call</TabBtn>
              <TabBtn on={panel === 'note'} onClick={() => setPanel('note')}><StickyNote className="h-3.5 w-3.5" /> Note</TabBtn>
              <TabBtn on={panel === 'demo'} onClick={() => setPanel('demo')}><CalendarClock className="h-3.5 w-3.5" /> {lead.demoAt ? 'Rebook demo' : 'Book demo'}</TabBtn>
              <TabBtn on={panel === 'issue'} onClick={() => setPanel('issue')}><Bug className="h-3.5 w-3.5" /> Feature / bug</TabBtn>
            </div>
            <div className="mt-3 space-y-3 rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3">
              {panel === 'call' && (
                <>
                  <p className="text-xs text-slate-400">Call #{lead.callsMade + 1}. Logging it updates calls made and moves the lead along the board.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CALL_OUTCOMES.map((o) => (
                      <button key={o} onClick={() => setOutcome(o)} className={`rounded-full border px-2.5 py-1 text-xs ${outcome === o ? 'border-blue-500 bg-blue-600/30 text-blue-200' : 'border-slate-600 text-slate-300'}`}>{CALL_OUTCOME_LABEL[o]}</button>
                    ))}
                  </div>
                  <textarea className={input} rows={3} value={callNote} onChange={(e) => setCallNote(e.target.value)} placeholder="What they said…" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block"><span className="mb-1 block text-xs text-slate-400">Next call (optional)</span>
                      <input className={input} type="datetime-local" value={nextCall} onChange={(e) => setNextCall(e.target.value)} /></label>
                    <label className="block"><span className="mb-1 block text-xs text-slate-400">Follow-up note</span>
                      <input className={input} value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} placeholder="after 7.30, ask for manager" /></label>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {[['Tomorrow 10am', 1, 10], ['In 3 days', 3, 10], ['Next week', 7, 10]].map(([label, days, hour]) => (
                      <button key={label as string} className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800" onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + (days as number));
                        d.setHours(hour as number, 0, 0, 0);
                        setNextCall(toLocalInput(d.getTime()));
                      }}>{label}</button>
                    ))}
                  </div>
                  <button className={btn.primary} disabled={busy} onClick={() => void run(
                    () => logCall(lead, { outcome, body: callNote, nextCallAt: fromLocalInput(nextCall), followUpNote: nextCall ? followUpNote : '' }),
                    () => { setCallNote(''); setNextCall(''); setFollowUpNote(''); setOutcome('spoke'); },
                  )}>{busy ? 'Saving…' : 'Log call'}</button>
                </>
              )}
              {panel === 'note' && (
                <>
                  <textarea className={input} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth remembering — billing arrangement, who to ask for…" />
                  <button className={btn.primary} disabled={busy || !note.trim()} onClick={() => void run(() => addLeadNote(lead, note), () => setNote(''))}>Add note</button>
                </>
              )}
              {panel === 'demo' && (
                <>
                  <input className={input} type="datetime-local" value={demoAt} onChange={(e) => setDemoAt(e.target.value)} />
                  <input className={input} value={demoNote} onChange={(e) => setDemoNote(e.target.value)} placeholder="Online / on site, who will attend…" />
                  <button className={btn.primary} disabled={busy || !demoAt} onClick={() => void run(() => bookDemo(lead, fromLocalInput(demoAt)!, demoNote), () => setDemoNote(''))}>Book demo</button>
                </>
              )}
              {panel === 'issue' && (
                <>
                  <div className="flex gap-1.5">
                    {(['feature', 'bug'] as const).map((t) => (
                      <button key={t} onClick={() => setIssueType(t)} className={`rounded-full border px-2.5 py-1 text-xs capitalize ${issueType === t ? 'border-blue-500 bg-blue-600/30 text-blue-200' : 'border-slate-600 text-slate-300'}`}>{t}</button>
                    ))}
                  </div>
                  <input className={input} value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} placeholder={issueType === 'bug' ? `Bug reported by ${lead.businessName}` : 'What they want FirmiCore to do'} />
                  <textarea className={input} rows={3} value={issueBody} onChange={(e) => setIssueBody(e.target.value)} placeholder="Details" />
                  <button className={btn.primary} disabled={busy} onClick={() => void run(
                    () => createFeatureRequest({ type: issueType, title: issueTitle.trim() || `${issueType === 'bug' ? 'Bug' : 'Feature'} requested by ${lead.businessName}`, description: issueBody, lead }),
                    () => { setIssueTitle(''); setIssueBody(''); },
                  )}>Add to Feature requests</button>
                </>
              )}
            </div>
          </div>

          {/* History on small screens */}
          <div className="md:hidden">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><History className="h-4 w-4 text-amber-300" /> History ({history.length})</p>
            <HistoryList rows={history} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function HistoryList({ rows }: { rows: LeadActivity[] }) {
  if (!rows.length) return <p className="p-4 text-sm text-slate-500">Nothing logged yet.</p>;
  return (
    <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      {rows.map((a) => (
        <li key={a.id} className="border-l-2 border-[#1E3A5F] pl-3">
          <p className="text-xs"><span className="font-semibold text-amber-300">{activityTypeLabel(a)}</span> <span className="text-slate-400">{activityOutcomeLabel(a)}</span></p>
          {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{a.body}</p>}
          {a.nextCallAt && a.type === 'call' && <p className="mt-1 text-xs text-sky-300">Next call {fmtDateTime(a.nextCallAt)}</p>}
          <p className="mt-1 text-[11px] text-slate-500">{fmtDateTime(a.at)}{a.authorEmail && ` · ${a.authorEmail}`}</p>
        </li>
      ))}
    </ol>
  );
}

function IconBtn({ title, onClick, active, children }: { title: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return <button title={title} aria-label={title} onClick={onClick} className={`rounded-md p-1.5 hover:bg-slate-800 hover:text-white ${active ? 'bg-slate-800 text-amber-300' : ''}`}>{children}</button>;
}

function TabBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${on ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{children}</button>;
}
