import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { countryLabel } from '@/lib/countries';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3, CalendarCheck, CalendarDays, Download, FileText, KanbanSquare, List, Phone, PhoneCall, Plus, Search, Trophy, Upload, Users, Wallet,
} from 'lucide-react';
import {
  LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_TAGS, fmtAmount, isOpen, leadStats, leadsToCsv, matchesSearch, revenueText,
  type Lead, type LeadStatus, type TeamMember,
} from '@/lib/platform/leads';
import { assignLeads, setLeadStatus, subscribeLeads, subscribeTeam } from '@/services/platformLeadsService';
import { ErrorNote, Loading, PageHeader, btn, fmtDateTime, input } from '../platformUi';
import LeadFormDialog from './LeadFormDialog';
import LeadDetailPanel from './LeadDetailPanel';
import DayReportDialog from './DayReportDialog';
import LeadImportDialog from './LeadImportDialog';
import LeadInsights from './LeadInsights';
import { STATUS_STYLE, StatusPill, TagChip, downloadText, whenLabel } from './leadUi';

type View = 'board' | 'list' | 'insights';
const VIEW_KEY = 'platformLeads.view';

function readView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'list' || v === 'insights' ? v : 'board';
  } catch {
    return 'board';
  }
}

/**
 * Lumora sales pipeline: leads from outside marketing (ads, referral
 * agents, imports), worked through calls → demo → close.
 */
export default function PlatformLeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setViewState] = useState<View>(readView);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [owner, setOwner] = useState('');
  const [source, setSource] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<'add' | 'edit' | 'day' | 'import' | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);
  const [params, setParams] = useSearchParams();
  const openId = params.get('lead');

  useEffect(() => subscribeLeads(setLeads, (e) => setError(e.message)), []);
  useEffect(() => subscribeTeam(setTeam, () => {}), []);

  function setView(v: View) {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ }
  }
  const openLead = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('lead', id);
    else next.delete('lead');
    setParams(next, { replace: true });
  };

  const all = useMemo(() => leads ?? [], [leads]);
  const memberName = (id: string | null) => team.find((m) => m.id === id)?.name ?? '';
  const sources = useMemo(() => [...new Set(all.map((l) => l.source).filter(Boolean))].sort(), [all]);
  const filtered = useMemo(() => all.filter((l) =>
    (showArchived ? l.archived : !l.archived)
    && matchesSearch(l, q)
    && (!tag || l.tags.includes(tag))
    && (!source || l.source === source)
    && (!owner || (owner === '__none' ? !l.assignedTo : l.assignedTo === owner || l.marketerId === owner)),
  ), [all, showArchived, q, tag, source, owner]);
  const stats = useMemo(() => leadStats(all), [all]);
  const current = openId ? all.find((l) => l.id === openId) ?? null : null;

  const byStatus = useMemo(() => {
    const m = Object.fromEntries(LEAD_STATUSES.map((s) => [s, [] as Lead[]])) as Record<LeadStatus, Lead[]>;
    for (const l of filtered) m[l.status].push(l);
    // Most urgent first: an overdue/soonest next call, then most recently touched.
    for (const s of LEAD_STATUSES) {
      m[s].sort((a, b) => (a.nextCallAt ?? Infinity) - (b.nextCallAt ?? Infinity) || (b.lastActivityAt ?? b.createdAt ?? 0) - (a.lastActivityAt ?? a.createdAt ?? 0));
    }
    return m;
  }, [filtered]);

  function onDrop(e: DragEvent, status: LeadStatus) {
    e.preventDefault();
    setDragOver(null);
    const lead = all.find((l) => l.id === e.dataTransfer.getData('text/plain'));
    if (lead && lead.status !== status) setLeadStatus(lead, status).catch((err) => setError(err.message));
  }

  async function bulkAssign(to: string) {
    try {
      await assignLeads([...selected], to === '__none' ? null : to);
      setNotice(`${selected.size} lead(s) ${to === '__none' ? 'unassigned' : `assigned to ${memberName(to)}`}.`);
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Prospects from outside marketing — calls, demos and follow-ups until they sign."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button className={`${btn.ghost} inline-flex items-center gap-1.5`} onClick={() => setDialog('day')}><FileText className="h-4 w-4" /> Day report</button>
            <button className={`${btn.ghost} inline-flex items-center gap-1.5`} title="Export the filtered leads as CSV"
              onClick={() => downloadText(`leads-${new Date().toISOString().slice(0, 10)}.csv`, leadsToCsv(filtered))}><Download className="h-4 w-4" /></button>
            <button className={`${btn.ghost} inline-flex items-center gap-1.5`} onClick={() => setDialog('import')}><Upload className="h-4 w-4" /> Import</button>
            <button className={`${btn.primary} inline-flex items-center gap-1.5`} onClick={() => setDialog('add')}><Plus className="h-4 w-4" /> Add lead</button>
          </div>
        }
      />

      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {notice && <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-emerald-300">{notice}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Users} tone="text-sky-300 bg-sky-900/40" value={stats.open} label="Open leads" />
        <StatTile icon={CalendarCheck} tone="text-violet-300 bg-violet-900/40" value={stats.demos} label="Demo booked or done" />
        <StatTile icon={CalendarDays} tone="text-fuchsia-300 bg-fuchsia-900/40" value={stats.demosToday} label="Demos today" />
        <StatTile icon={PhoneCall} tone="text-amber-300 bg-amber-900/40" value={stats.followUpsDue} label="Follow-ups due" />
        <StatTile icon={Trophy} tone="text-emerald-300 bg-emerald-900/40" value={stats.won} label="Closed won" />
        <StatTile icon={Wallet} tone="text-teal-300 bg-teal-900/40" value={revenueText(stats.revenue)} label="Revenue" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input className={`${input} pl-9!`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, city, campaign…" />
        </div>
        <select className={`${input} w-auto!`} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>{LEAD_TAGS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className={`${input} w-auto!`} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>{sources.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={`${input} w-auto!`} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Everyone</option><option value="__none">Unassigned</option>
          {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-400"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived</label>
        <div className="flex overflow-hidden rounded-lg border border-[#1E3A5F]">
          <ViewBtn on={view === 'board'} onClick={() => setView('board')} title="Board"><KanbanSquare className="h-4 w-4" /></ViewBtn>
          <ViewBtn on={view === 'list'} onClick={() => setView('list')} title="List"><List className="h-4 w-4" /></ViewBtn>
          <ViewBtn on={view === 'insights'} onClick={() => setView('insights')} title="Insights"><BarChart3 className="h-4 w-4" /></ViewBtn>
        </div>
      </div>

      {!leads && !error ? <Loading /> : view === 'insights' ? (
        <LeadInsights leads={all} team={team} onOpenLead={openLead} />
      ) : view === 'board' ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
          <div className="flex gap-3">
            {LEAD_STATUSES.map((s) => (
              <div
                key={s}
                className={`flex w-72 shrink-0 flex-col rounded-xl ${dragOver === s ? 'ring-2 ring-blue-500' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(s); }}
                onDragLeave={() => setDragOver((d) => (d === s ? null : d))}
                onDrop={(e) => onDrop(e, s)}
              >
                <div className={`flex items-center justify-between rounded-t-xl px-3 py-2 ${STATUS_STYLE[s].header}`}>
                  <span className="text-sm font-semibold text-white">{LEAD_STATUS_LABEL[s]}</span>
                  <span className="rounded-full bg-black/30 px-2 text-xs font-semibold text-white">{byStatus[s].length}</span>
                </div>
                <div className="max-h-[calc(100vh-380px)] min-h-[120px] space-y-2 overflow-y-auto rounded-b-xl border border-t-0 border-[#1E3A5F] bg-[#0B1A2E] p-2">
                  {byStatus[s].map((l) => <LeadCard key={l.id} lead={l} owner={memberName(l.assignedTo)} onOpen={() => openLead(l.id)} />)}
                  {byStatus[s].length === 0 && <p className="py-6 text-center text-xs text-slate-600">Drop a lead here</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {selected.size > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-blue-800/60 bg-blue-950/40 p-2 text-sm">
              <span className="text-blue-200">{selected.size} selected</span>
              <select className={`${input} w-auto!`} defaultValue="" onChange={(e) => { if (e.target.value) void bulkAssign(e.target.value); e.target.value = ''; }}>
                <option value="">Assign to…</option><option value="__none">— Unassigned</option>
                {team.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button className={btn.ghost} onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-[#1E3A5F]">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#0F1E35] text-xs text-slate-400">
                <tr>
                  <th className="px-3 py-2"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((l) => l.id)) : new Set())} /></th>
                  <th className="px-3 py-2">Business</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Source</th><th className="px-3 py-2">Assigned</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Calls</th><th className="px-3 py-2">Next call</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="cursor-pointer border-t border-[#1E3A5F] hover:bg-[#142849]" onClick={() => openLead(l.id)}>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(l.id)} onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(l.id); else next.delete(l.id);
                        setSelected(next);
                      }} />
                    </td>
                    <td className="px-3 py-2"><span className="font-medium text-white">{l.businessName}</span> <span className="ml-1 inline-flex gap-1">{l.tags.map((t) => <TagChip key={t} tag={t} />)}</span></td>
                    <td className="px-3 py-2 text-slate-300">{l.contactPerson}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">{l.phone}</td>
                    <td className="px-3 py-2 text-slate-300">{l.location || countryLabel(l.district)}</td>
                    <td className="px-3 py-2 text-slate-400">{l.source}</td>
                    <td className="px-3 py-2 text-slate-300">{memberName(l.assignedTo) || <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-2"><StatusPill status={l.status} /></td>
                    <td className="px-3 py-2 text-right text-slate-300">{l.callsMade}</td>
                    <td className={`px-3 py-2 text-xs ${l.nextCallAt && l.nextCallAt < Date.now() && isOpen(l) ? 'text-red-300' : 'text-slate-400'}`}>
                      {l.nextCallAt ? <>{fmtDateTime(l.nextCallAt)}{l.followUpNote && <span className="block text-slate-500">{l.followUpNote}</span>}</> : '—'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={10} className="px-3 py-10 text-center text-slate-500">No leads match.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(dialog === 'add' || (dialog === 'edit' && current)) && (
        <LeadFormDialog lead={dialog === 'edit' ? current : null} allLeads={all} team={team} onClose={() => setDialog(null)} onSaved={(id) => openLead(id)} />
      )}
      {dialog === 'day' && <DayReportDialog leads={all} onClose={() => setDialog(null)} onOpenLead={(id) => { setDialog(null); openLead(id); }} />}
      {dialog === 'import' && <LeadImportDialog leads={all} team={team} onClose={() => setDialog(null)} onDone={(n) => setNotice(`${n} lead(s) imported.`)} />}
      {current && dialog !== 'edit' && <LeadDetailPanel lead={current} team={team} onClose={() => openLead(null)} onEdit={() => setDialog('edit')} />}
    </div>
  );
}

function LeadCard({ lead, owner, onOpen }: { lead: Lead; owner: string; onOpen: () => void }) {
  const overdue = lead.nextCallAt && lead.nextCallAt < Date.now() && isOpen(lead);
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', lead.id); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={onOpen}
      className="cursor-pointer rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-3 hover:border-blue-700"
    >
      <p className="truncate text-sm font-semibold text-white" title={lead.businessName}>{lead.businessName}</p>
      <div className="mt-0.5 flex justify-between gap-2 text-xs text-slate-400">
        <span className="truncate">{lead.contactPerson}</span>
        <span className="truncate text-slate-500">{lead.location || countryLabel(lead.district)}</span>
      </div>
      {lead.phone && <p className="mt-0.5 font-mono text-[11px] text-slate-500">{lead.phone}</p>}
      {(lead.tags.length > 0 || lead.demoAt) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.map((t) => <TagChip key={t} tag={t} />)}
          {lead.demoAt && lead.status !== 'closed_won' && lead.status !== 'closed_lost' && (
            <span className="rounded-full bg-violet-900/60 px-2 py-px text-[10px] font-semibold text-violet-200">
              Demo {new Date(lead.demoAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{lead.callsMade}{owner && <span className="ml-1 truncate">· {owner}</span>}</span>
        {lead.nextCallAt && isOpen(lead) ? (
          <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-300' : 'text-sky-300'}`}><CalendarDays className="h-3 w-3" />{whenLabel(lead.nextCallAt)}</span>
        ) : lead.status === 'closed_won' && lead.closedAmount > 0 ? (
          <span className="text-emerald-300">{fmtAmount(lead.closedAmount, lead.currency)}</span>
        ) : null}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, tone, value, label }: { icon: typeof Users; tone: string; value: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="truncate text-xl font-bold text-white">{value}</p><p className="truncate text-xs text-slate-400" title={label}>{label}</p></div>
    </div>
  );
}

function ViewBtn({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return <button title={title} aria-label={title} onClick={onClick} className={`px-2.5 py-2 ${on ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{children}</button>;
}
