import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Circle, CheckCircle2, FlaskConical, Lightbulb, Pencil, PhoneCall, Plus, Trash2 } from 'lucide-react';
import type { Lead } from '@/lib/platform/leads';
import { TODO_BUCKET_LABEL, TODO_KIND_LABEL, groupTodos, type Todo, type TodoKind } from '@/lib/platform/todos';
import { subscribeLeads } from '@/services/platformLeadsService';
import { deleteTodo, setTodoDone, subscribeTodos } from '@/services/platformTodosService';
import { ErrorNote, Loading, PageHeader, btn, fmtDateTime } from '../platformUi';
import { useCompanyOptions } from '../useCompanyOptions';
import TodoDialog from './TodoDialog';

const BUCKET_TONE: Record<string, string> = {
  overdue: 'text-red-300', today: 'text-amber-300', upcoming: 'text-sky-300', someday: 'text-slate-300', done: 'text-emerald-300',
};

/**
 * Lumora's to-do list: call-back reminders linked to a lead, tasks for a
 * company, and testing to-dos created when a feature request moves to
 * Testing — ticking one of those closes the request.
 */
export default function PlatformTodosPage() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const companies = useCompanyOptions();
  const [error, setError] = useState('');
  const [kind, setKind] = useState<'' | TodoKind>('');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Todo | 'new' | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeTodos(setTodos, (e) => setError(e.message)), []);
  useEffect(() => subscribeLeads(setLeads, () => {}), []);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const groups = useMemo(() => groupTodos((todos ?? []).filter((t) => (!kind || t.kind === kind) && (showDone || !t.done)), now), [todos, kind, showDone, now]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { '': 0, reminder: 0, task: 0, testing: 0 };
    for (const t of todos ?? []) if (!t.done) { c['']++; c[t.kind]++; }
    return c;
  }, [todos]);

  async function toggle(t: Todo) {
    if (!t.done && t.kind === 'testing' && t.featureRequestId && !window.confirm('Testing passed? This also closes the feature request.')) return;
    await setTodoDone(t, !t.done).catch((e) => setError(e.message));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="To-Do"
        subtitle="Call-back reminders, tasks and testing. Link a to-do to a lead or a company; finishing a testing to-do closes its feature request."
        actions={<button className={`${btn.primary} inline-flex items-center gap-1.5`} onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> New to-do</button>}
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {([['', 'All'], ['reminder', 'Reminders'], ['task', 'Tasks'], ['testing', 'Testing']] as const).map(([v, l]) => (
          <button key={l} onClick={() => setKind(v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${kind === v ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
            {l}<span className="rounded-full bg-black/30 px-1.5 text-[10px] font-bold leading-4">{counts[v]}</span>
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-400"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done</label>
      </div>

      {!todos && !error ? <Loading /> : groups.length === 0 ? (
        <p className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-8 text-center text-sm text-slate-400">Nothing to do. Add a reminder for your next call-back.</p>
      ) : groups.map((g) => (
        <section key={g.bucket} className="mb-6">
          <h2 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${BUCKET_TONE[g.bucket]}`}>{TODO_BUCKET_LABEL[g.bucket]} · {g.items.length}</h2>
          <ul className="divide-y divide-[#1E3A5F] overflow-hidden rounded-xl border border-[#1E3A5F] bg-[#0F1E35]">
            {g.items.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <button onClick={() => void toggle(t)} title={t.done ? 'Mark as not done' : 'Mark as done'} className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-300">
                  {t.done ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${t.done ? 'text-slate-500 line-through' : 'text-white'}`}>
                    {t.kind === 'testing' && <FlaskConical className="mr-1 inline h-3.5 w-3.5 text-sky-300" />}{t.title}
                  </p>
                  {t.notes && <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-400">{t.notes}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-600 px-1.5 text-[10px]">{TODO_KIND_LABEL[t.kind]}</span>
                    {t.dueAt && <span className={!t.done && t.dueAt < now ? 'text-red-300' : ''}>{fmtDateTime(t.dueAt)}</span>}
                    {t.leadId && <Link to={`/platform/leads?lead=${t.leadId}`} className="inline-flex items-center gap-1 text-sky-300!"><PhoneCall className="h-3 w-3" />{t.leadName ?? 'Lead'}</Link>}
                    {t.companyId && <Link to={`/platform/companies/${t.companyId}`} className="inline-flex items-center gap-1 text-sky-300!"><Building2 className="h-3 w-3" />{t.companyName ?? 'Company'}</Link>}
                    {t.featureRequestId && <Link to="/platform/feature-requests" className="inline-flex items-center gap-1 text-sky-300!"><Lightbulb className="h-3 w-3" />Feature request</Link>}
                  </p>
                </div>
                <div className="flex shrink-0 text-slate-400">
                  <button title="Edit" className="rounded p-1.5 hover:bg-slate-800 hover:text-white" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></button>
                  <button title="Delete" className="rounded p-1.5 hover:bg-slate-800 hover:text-white" onClick={() => window.confirm('Delete this to-do?') && void deleteTodo(t.id).catch((e) => setError(e.message))}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && (
        <TodoDialog todo={editing === 'new' ? null : editing} leads={leads} companies={companies} onClose={() => setEditing(null)} onError={setError} />
      )}
    </div>
  );
}
