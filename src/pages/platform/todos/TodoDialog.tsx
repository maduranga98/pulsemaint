import { useMemo, useState } from 'react';
import { ListTodo } from 'lucide-react';
import type { Lead } from '@/lib/platform/leads';
import { TODO_KINDS, TODO_KIND_LABEL, type Todo, type TodoKind } from '@/lib/platform/todos';
import { createTodo, updateTodo, type TodoInput } from '@/services/platformTodosService';
import { btn, input } from '../platformUi';
import { Field, Modal } from '../leads/leadUi';
import type { CompanyOption } from '../useCompanyOptions';

const pad = (n: number) => String(n).padStart(2, '0');
function toLocalInput(ms: number | null): string {
  if (ms == null) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Quick due-date presets, like a phone reminder app. */
function preset(kind: 'later' | 'tomorrow' | 'nextWeek'): number {
  const d = new Date();
  if (kind === 'later') {
    d.setHours(d.getHours() + 3, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + (kind === 'tomorrow' ? 1 : 7));
    d.setHours(9, 0, 0, 0);
  }
  return d.getTime();
}

/** Create or edit a to-do / reminder, optionally linked to a lead (call) and/or a company. */
export default function TodoDialog({ todo, initial, leads, companies, onClose, onError }: {
  todo?: Todo | null;
  initial?: Partial<TodoInput>;
  leads: Lead[];
  companies: CompanyOption[];
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const [draft, setDraft] = useState<TodoInput>(() => ({
    kind: todo?.kind ?? initial?.kind ?? 'reminder',
    title: todo?.title ?? initial?.title ?? '',
    notes: todo?.notes ?? initial?.notes ?? '',
    dueAt: todo ? todo.dueAt : initial?.dueAt ?? preset('tomorrow'),
    leadId: todo?.leadId ?? initial?.leadId ?? null,
    leadName: todo?.leadName ?? initial?.leadName ?? null,
    companyId: todo?.companyId ?? initial?.companyId ?? null,
    companyName: todo?.companyName ?? initial?.companyName ?? null,
    featureRequestId: todo?.featureRequestId ?? initial?.featureRequestId ?? null,
  }));
  const [busy, setBusy] = useState(false);
  const leadOptions = useMemo(() => leads.filter((l) => !l.archived || l.id === draft.leadId).sort((a, b) => a.businessName.localeCompare(b.businessName)), [leads, draft.leadId]);

  async function save() {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      if (todo) await updateTodo(todo.id, draft);
      else await createTodo(draft);
      onClose();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={<><ListTodo className="h-4 w-4 text-blue-300" /> {todo ? 'Edit to-do' : 'New to-do'}</>}
      onClose={onClose}
      footer={<>
        <button className={btn.ghost} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy || !draft.title.trim()} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {TODO_KINDS.filter((k) => k !== 'testing' || draft.kind === 'testing').map((k) => (
            <button key={k} onClick={() => setDraft({ ...draft, kind: k as TodoKind })}
              className={`rounded-full border px-3 py-1 text-xs ${draft.kind === k ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
              {TODO_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <Field label="Title *"><input className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Call back about the Factory Pro quote" autoFocus /></Field>
        <Field label="Notes"><textarea className={input} rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
        <Field label="Due">
          <div className="flex flex-wrap items-center gap-2">
            <input type="datetime-local" className={`${input} w-auto!`} value={toLocalInput(draft.dueAt)}
              onChange={(e) => setDraft({ ...draft, dueAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
            {([['later', 'In 3 hours'], ['tomorrow', 'Tomorrow 9:00'], ['nextWeek', 'Next week']] as const).map(([k, l]) => (
              <button key={k} type="button" className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800" onClick={() => setDraft({ ...draft, dueAt: preset(k) })}>{l}</button>
            ))}
            <button type="button" className="rounded px-2 py-1 text-xs text-slate-400 hover:text-white" onClick={() => setDraft({ ...draft, dueAt: null })}>No date</button>
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lead / call (optional)">
            <select className={input} value={draft.leadId ?? ''} onChange={(e) => {
              const l = leads.find((x) => x.id === e.target.value);
              setDraft({ ...draft, leadId: l?.id ?? null, leadName: l?.businessName ?? null });
            }}>
              <option value="">—</option>
              {leadOptions.map((l) => <option key={l.id} value={l.id}>{l.businessName}</option>)}
            </select>
          </Field>
          <Field label="Company (optional)">
            <select className={input} value={draft.companyId ?? ''} onChange={(e) => {
              const c = companies.find((x) => x.id === e.target.value);
              setDraft({ ...draft, companyId: c?.id ?? null, companyName: c?.name ?? null });
            }}>
              <option value="">—</option>
              {draft.companyId && !companies.some((c) => c.id === draft.companyId) && <option value={draft.companyId}>{draft.companyName ?? draft.companyId}</option>}
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
