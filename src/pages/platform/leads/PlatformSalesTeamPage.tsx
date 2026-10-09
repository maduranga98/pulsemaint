import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Pencil, Plus, Trash2, UserCog } from 'lucide-react';
import {
  TEAM_ROLES, TEAM_ROLE_LABEL, commissionFor, groupStats, revenueText, whatsappNumber,
  type Lead, type TeamMember, type TeamRole,
} from '@/lib/platform/leads';
import { deleteTeamMember, saveTeamMember, subscribeLeads, subscribeTeam } from '@/services/platformLeadsService';
import { Badge, ErrorNote, Loading, PageHeader, btn, input } from '../platformUi';
import { Field, Modal } from './leadUi';

type Draft = Omit<TeamMember, 'id'> & { id?: string };
const blank: Draft = { name: '', phone: '', email: '', role: 'marketer', commissionPct: 0, active: true, notes: '' };

/**
 * The people who bring in and work leads — outside marketers, referral
 * agents, callers. A roster for assignment and commission only: no login.
 */
export default function PlatformSalesTeamPage() {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => subscribeTeam(setTeam, (e) => setError(e.message)), []);
  useEffect(() => subscribeLeads(setLeads, () => {}), []);

  const brought = useMemo(() => new Map(groupStats(leads, (l) => l.marketerId).map((g) => [g.key, g])), [leads]);
  const assigned = useMemo(() => new Map(groupStats(leads, (l) => l.assignedTo).map((g) => [g.key, g])), [leads]);
  const callsDue = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const m = new Map<string, number>();
    for (const l of leads) {
      if (l.archived || !l.assignedTo || !l.nextCallAt || l.nextCallAt > end.getTime() || ['closed_won', 'closed_lost'].includes(l.status)) continue;
      m.set(l.assignedTo, (m.get(l.assignedTo) ?? 0) + 1);
    }
    return m;
  }, [leads]);
  const unassignedOpen = leads.filter((l) => !l.archived && !l.assignedTo && !['closed_won', 'closed_lost'].includes(l.status)).length;
  const rows = (team ?? []).filter((m) => showInactive || m.active);

  async function save() {
    if (!draft?.name.trim()) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveTeamMember(draft);
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: TeamMember) {
    if (!window.confirm(`Remove ${m.name}? Their leads become unassigned. Mark them inactive instead to keep their history and commission figures.`)) return;
    try {
      await deleteTeamMember(m.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sales team"
        subtitle="Outside marketers, referral agents and callers who bring in and work leads. A roster for assigning leads and tracking commission — they don't get a FirmiCore login."
        actions={<button className={`${btn.primary} inline-flex items-center gap-1.5`} onClick={() => setDraft({ ...blank })}><Plus className="h-4 w-4" /> Add member</button>}
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {unassignedOpen > 0 && (
        <p className="mb-4 rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-200">
          {unassignedOpen} open lead(s) have nobody assigned. <Link to="/platform/leads" className="underline">Assign them from the Leads list view</Link> (tick several → Assign to…).
        </p>
      )}
      <label className="mb-3 flex items-center gap-1.5 text-xs text-slate-400"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
      {!team && !error ? <Loading /> : rows.length === 0 ? (
        <p className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-8 text-center text-sm text-slate-400">No team members yet. Add the marketers and agents who send you leads.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1E3A5F]">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-[#0F1E35] text-xs text-slate-400">
              <tr>
                <th className="px-3 py-2">Member</th><th className="px-3 py-2">Role</th>
                <th className="px-3 py-2 text-right" title="Leads they brought in">Brought in</th><th className="px-3 py-2 text-right">Won</th><th className="px-3 py-2 text-right">Win rate</th>
                <th className="px-3 py-2 text-right">Revenue</th><th className="px-3 py-2 text-right">Commission</th>
                <th className="px-3 py-2 text-right" title="Open leads assigned to them">Working</th><th className="px-3 py-2 text-right">Calls due</th><th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const b = brought.get(m.id);
                const a = assigned.get(m.id);
                const wa = whatsappNumber(m.phone);
                return (
                  <tr key={m.id} className={`border-t border-[#1E3A5F] ${m.active ? '' : 'opacity-60'}`}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-white">{m.name} {!m.active && <Badge>inactive</Badge>}</p>
                      <p className="text-xs text-slate-500">
                        {m.phone}{m.phone && wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="ml-1 inline-flex text-emerald-300"><MessageCircle className="h-3 w-3" /></a>}
                        {m.email && <> · {m.email}</>}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{TEAM_ROLE_LABEL[m.role]}{m.commissionPct > 0 && <span className="text-xs text-slate-500"> · {m.commissionPct}%</span>}</td>
                    <td className="px-3 py-2 text-right">{b?.leads ?? 0}</td>
                    <td className="px-3 py-2 text-right text-emerald-300">{b?.won ?? 0}</td>
                    <td className="px-3 py-2 text-right">{b?.winRate != null ? `${Math.round(b.winRate * 100)}%` : '—'}</td>
                    <td className="px-3 py-2 text-right text-xs">{b ? revenueText(b.revenue) : '0'}</td>
                    <td className="px-3 py-2 text-right text-xs text-amber-300">{revenueText(commissionFor(m, leads))}</td>
                    <td className="px-3 py-2 text-right">{a?.open ?? 0}</td>
                    <td className={`px-3 py-2 text-right ${callsDue.get(m.id) ? 'text-red-300' : 'text-slate-500'}`}>{callsDue.get(m.id) ?? 0}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-slate-400">
                      <button title="Edit" className="rounded p-1.5 hover:bg-slate-800 hover:text-white" onClick={() => setDraft({ ...m })}><Pencil className="h-4 w-4" /></button>
                      <button title="Remove" className="rounded p-1.5 hover:bg-slate-800 hover:text-white" onClick={() => void remove(m)}><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Commission = member's % × closed amount of the won leads they brought in. Revenue counts only those leads.</p>

      {draft && (
        <Modal
          title={<><UserCog className="h-4 w-4 text-blue-300" /> {draft.id ? 'Edit member' : 'Add member'}</>}
          onClose={() => setDraft(null)}
          footer={<>
            <button className={btn.ghost} onClick={() => setDraft(null)}>Cancel</button>
            <button className={btn.primary} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
          </>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus /></Field>
            <Field label="Role">
              <select className={input} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as TeamRole })}>
                {TEAM_ROLES.map((r) => <option key={r} value={r}>{TEAM_ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            <Field label="Phone"><input className={input} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} inputMode="tel" /></Field>
            <Field label="Email"><input className={input} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
            <Field label="Commission %" hint="Of the closed amount, on leads they brought in.">
              <input className={input} type="number" min={0} max={100} step={0.5} value={draft.commissionPct} onChange={(e) => setDraft({ ...draft, commissionPct: Number(e.target.value) || 0 })} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active (can be assigned new leads)
            </label>
            <Field label="Notes" className="sm:col-span-2"><textarea className={input} rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Area they cover, payment details for commission…" /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
