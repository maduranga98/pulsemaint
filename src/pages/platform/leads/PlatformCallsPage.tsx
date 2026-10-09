import { useEffect, useMemo, useState } from 'react';
import { countryLabel } from '@/lib/countries';
import { Link } from 'react-router-dom';
import { ExternalLink, MapPin, MessageCircle, Phone, PhoneCall, StickyNote, XCircle } from 'lucide-react';
import { isOpen, scheduledCalls, whatsappNumber, type Lead, type TeamMember } from '@/lib/platform/leads';
import { clearNextCall, subscribeLeads, subscribeTeam } from '@/services/platformLeadsService';
import { ErrorNote, Loading, PageHeader, fmtDateTime, input } from '../platformUi';
import { StatusPill, TagChip, whenLabel } from './leadUi';

/** Every next call booked on a lead, soonest first. Opens the lead for the full history. */
export default function PlatformCallsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState('');
  const [owner, setOwner] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeLeads(setLeads, (e) => setError(e.message)), []);
  useEffect(() => subscribeTeam(setTeam, () => {}), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const buckets = useMemo(
    () => scheduledCalls((leads ?? []).filter((l) => !owner || (owner === '__none' ? !l.assignedTo : l.assignedTo === owner)), now),
    [leads, owner, now],
  );
  const demosToday = useMemo(() => {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return (leads ?? []).filter((l) => isOpen(l) && l.demoAt && l.demoAt >= now - 3_600_000 && l.demoAt <= end.getTime()).sort((a, b) => a.demoAt! - b.demoAt!);
  }, [leads, now]);
  const memberName = (id: string | null) => team.find((m) => m.id === id)?.name ?? '';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Scheduled calls"
        subtitle="Every next call booked from a lead's log, soonest first. Opens straight into Leads for the full history."
        actions={
          <select className={`${input} w-auto!`} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Everyone's calls</option><option value="__none">Unassigned</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        }
      />
      {error && <ErrorNote message={error} />}
      {!leads && !error ? <Loading /> : (
        <div className="space-y-6">
          {demosToday.length > 0 && (
            <Section title={`Demos today (${demosToday.length})`} tone="text-violet-300">
              {demosToday.map((l) => <CallCard key={l.id} lead={l} at={l.demoAt!} owner={memberName(l.assignedTo)} kind="demo" now={now} />)}
            </Section>
          )}
          <Section title={`Overdue (${buckets.overdue.length})`} tone="text-red-300">
            {buckets.overdue.map((l) => <CallCard key={l.id} lead={l} at={l.nextCallAt!} owner={memberName(l.assignedTo)} overdue now={now} />)}
          </Section>
          <Section title={`Today (${buckets.today.length})`} tone="text-amber-300">
            {buckets.today.map((l) => <CallCard key={l.id} lead={l} at={l.nextCallAt!} owner={memberName(l.assignedTo)} now={now} />)}
          </Section>
          <Section title={`Upcoming (${buckets.upcoming.length})`} tone="text-sky-300">
            {buckets.upcoming.map((l) => <CallCard key={l.id} lead={l} at={l.nextCallAt!} owner={memberName(l.assignedTo)} now={now} />)}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, tone, children }: { title: string; tone: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h2 className={`mb-2 text-xs font-bold uppercase tracking-wider ${tone}`}>{title}</h2>
      <div className="space-y-2">{children.length ? children : <p className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4 text-sm text-slate-500">Nothing here.</p>}</div>
    </section>
  );
}

function CallCard({ lead, at, owner, overdue, kind = 'call', now }: { lead: Lead; at: number; owner: string; overdue?: boolean; kind?: 'call' | 'demo'; now: number }) {
  const [error, setError] = useState('');
  const wa = whatsappNumber(lead.phone);
  return (
    <div className={`rounded-xl border bg-[#0F1E35] p-4 ${overdue ? 'border-red-800/70' : kind === 'demo' ? 'border-violet-800/70' : 'border-[#1E3A5F]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white">{lead.businessName}</p>
          {lead.contactPerson && <p className="text-sm text-slate-400">{lead.contactPerson}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1.5"><StatusPill status={lead.status} />{lead.tags.map((t) => <TagChip key={t} tag={t} />)}</div>
          <p className={`mt-1 flex items-center gap-1.5 text-sm ${overdue ? 'text-red-300' : kind === 'demo' ? 'text-violet-300' : 'text-sky-300'}`}>
            <PhoneCall className="h-3.5 w-3.5" />{kind === 'demo' ? 'Demo ' : ''}{fmtDateTime(at)} <span className="text-xs text-slate-500">{whenLabel(at, now)}</span>
            {owner && <span className="text-xs text-slate-400">· {owner}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-slate-400">
          {kind === 'call' && (
            <button title="Remove from calls (no call logged)" className="rounded p-1.5 hover:bg-slate-800 hover:text-white" onClick={() => clearNextCall(lead.id).catch((e) => setError(e.message))}>
              <XCircle className="h-4 w-4" />
            </button>
          )}
          <Link title="Open lead" to={`/platform/leads?lead=${lead.id}`} className="rounded p-1.5 hover:bg-slate-800 hover:text-white"><ExternalLink className="h-4 w-4" /></Link>
        </div>
      </div>
      {lead.followUpNote && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{lead.followUpNote}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#1E3A5F] pt-2 text-xs text-slate-400">
        <span className="flex flex-wrap items-center gap-3">
          {lead.phone && (
            <>
              <a href={`tel:${lead.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 hover:text-white"><Phone className="h-3 w-3" />{lead.phone}</a>
              {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline"><MessageCircle className="h-3 w-3" />WhatsApp</a>}
            </>
          )}
          {(lead.location || lead.district) && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[lead.location, countryLabel(lead.district)].filter(Boolean).join(', ')}</span>}
        </span>
        {lead.notes && <span className="inline-flex max-w-md items-center gap-1 truncate"><StickyNote className="h-3 w-3 shrink-0" /><span className="truncate">{lead.notes}</span></span>}
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
