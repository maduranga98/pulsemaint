import { useState } from 'react';
import { UserPlus, Pencil } from 'lucide-react';
import {
  LEAD_CURRENCIES, LEAD_SOURCES, LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_TAGS, emptyLead, phoneKey,
  type Lead, type LeadInput, type TeamMember,
} from '@/lib/platform/leads';
import { createLead, updateLead } from '@/services/platformLeadsService';
import { ErrorNote, btn, input } from '../platformUi';
import { Field, Modal, fromDateInput, fromLocalInput, toDateInput, toLocalInput } from './leadUi';

export const SRI_LANKA_DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle',
  'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam',
  'Ratnapura', 'Trincomalee', 'Vavuniya',
];

function pick(l: Lead): LeadInput {
  const { id: _i, createdAt: _c, updatedAt: _u, lastActivityAt: _a, createdByEmail: _e, archived: _ar, closedAt: _cl, ...rest } = l;
  return rest;
}

/** Add a lead, or edit one (pass `lead`). */
export default function LeadFormDialog({ lead, allLeads, team, onClose, onSaved }: {
  lead?: Lead | null; allLeads: Lead[]; team: TeamMember[]; onClose: () => void; onSaved?: (id: string) => void;
}) {
  const memberOptions = (current: string | null) => team.filter((m) => m.active || m.id === current);
  const [f, setF] = useState<LeadInput>(() => (lead ? pick(lead) : emptyLead()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof LeadInput>(k: K, v: LeadInput[K]) => setF((p) => ({ ...p, [k]: v }));

  const dup = f.phone && phoneKey(f.phone).length >= 9
    ? allLeads.find((l) => l.id !== lead?.id && phoneKey(l.phone) === phoneKey(f.phone))
    : undefined;

  async function save() {
    if (!f.businessName.trim()) {
      setError('Business name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (lead) {
        await updateLead(lead, f);
        onSaved?.(lead.id);
      } else {
        const id = await createLead(f);
        onSaved?.(id);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not save the lead');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={lead ? <><Pencil className="h-4 w-4 text-blue-300" /> Edit lead</> : <><UserPlus className="h-4 w-4 text-blue-300" /> Add lead</>}
      onClose={onClose}
      footer={<>
        <button className={btn.ghost} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : lead ? 'Save changes' : 'Add lead'}</button>
      </>}
    >
      {error && <div className="mb-3"><ErrorNote message={error} /></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Business name *"><input className={input} value={f.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="Silva Engineering (Pvt) Ltd" autoFocus /></Field>
        <Field label="Contact person"><input className={input} value={f.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} placeholder="Nimal Silva" /></Field>
        <Field label="Phone" hint={dup ? `Same number as “${dup.businessName}” — possible duplicate.` : undefined}>
          <input className={input} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="077 123 4567" inputMode="tel" />
        </Field>
        <Field label="Email"><input className={input} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="owner@example.com" /></Field>
        <Field label="Location"><input className={input} value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Nugegoda" /></Field>
        <Field label="District">
          <select className={input} value={f.district} onChange={(e) => set('district', e.target.value)}>
            <option value="">—</option>
            {SRI_LANKA_DISTRICTS.map((d) => <option key={d}>{d}</option>)}
            {f.district && !SRI_LANKA_DISTRICTS.includes(f.district) && <option>{f.district}</option>}
          </select>
        </Field>
        <Field label="Source" hint="Which outside channel brought them in.">
          <input className={input} list="lead-sources" value={f.source} onChange={(e) => set('source', e.target.value)} placeholder="Facebook ad" />
          <datalist id="lead-sources">{LEAD_SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="Campaign / ad"><input className={input} value={f.campaign} onChange={(e) => set('campaign', e.target.value)} placeholder="Oct factory CMMS ad" /></Field>
        <Field label="Brought in by" hint="Outside marketer / agent — earns the commission.">
          <select className={input} value={f.marketerId ?? ''} onChange={(e) => set('marketerId', e.target.value || null)}>
            <option value="">— Lumora (direct)</option>
            {memberOptions(f.marketerId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Assigned to" hint="Who calls and demos this lead.">
          <select className={input} value={f.assignedTo ?? ''} onChange={(e) => set('assignedTo', e.target.value || null)}>
            <option value="">— Unassigned</option>
            {memberOptions(f.assignedTo).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Industry"><input className={input} value={f.industry} onChange={(e) => set('industry', e.target.value)} placeholder="Garment factory, workshop…" /></Field>
        <Field label="Lead date"><input className={input} type="date" value={toDateInput(f.leadDate)} onChange={(e) => set('leadDate', fromDateInput(e.target.value))} /></Field>
        <Field label="Status">
          <select className={input} value={f.status} onChange={(e) => set('status', e.target.value as LeadInput['status'])}>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Calls made" hint="Logging a call raises this on its own — set it here only to back-fill.">
          <input className={input} type="number" min={0} value={f.callsMade} onChange={(e) => set('callsMade', Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="Next call"><input className={input} type="datetime-local" value={toLocalInput(f.nextCallAt)} onChange={(e) => set('nextCallAt', fromLocalInput(e.target.value))} /></Field>
        <Field label="Follow-up note" hint="e.g. “after 7.30”, “call the manager”.">
          <input className={input} value={f.followUpNote} onChange={(e) => set('followUpNote', e.target.value)} placeholder="Next week visit" />
        </Field>
        <Field label="Demo date & time"><input className={input} type="datetime-local" value={toLocalInput(f.demoAt)} onChange={(e) => set('demoAt', fromLocalInput(e.target.value))} /></Field>
        <Field label="Price told?"><input className={input} value={f.priceQuoted} onChange={(e) => set('priceQuoted', e.target.value)} placeholder="What was quoted, and what they said" /></Field>
        <Field label="Closed amount" hint="Once they sign. Adds to the revenue figure on the board.">
          <div className="flex gap-2">
            <select className={`${input} w-24!`} value={f.currency} onChange={(e) => set('currency', e.target.value as LeadInput['currency'])}>
              {LEAD_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className={input} type="number" min={0} value={f.closedAmount || ''} onChange={(e) => set('closedAmount', Math.max(0, Number(e.target.value) || 0))} placeholder="0" />
          </div>
        </Field>
        <Field label="Main problem" className="sm:col-span-2" hint="What is wrong for them today — the reason they would buy.">
          <input className={input} value={f.mainProblem} onChange={(e) => set('mainProblem', e.target.value)} placeholder="Breakdowns tracked on paper / no PM schedule / spare parts run out" />
        </Field>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-400">Tags</span>
          <div className="flex flex-wrap gap-2">
            {LEAD_TAGS.map((t) => {
              const on = f.tags.includes(t);
              return (
                <button key={t} type="button" onClick={() => set('tags', on ? f.tags.filter((x) => x !== t) : [...f.tags, t])}
                  className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-blue-500 bg-blue-600/30 text-blue-200' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
          <input type="checkbox" checked={f.demoRequested} onChange={(e) => set('demoRequested', e.target.checked)} /> They've asked for a demo
        </label>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className={input} rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Background worth keeping — number of machines, what they use today, who decides." />
        </Field>
      </div>
    </Modal>
  );
}
