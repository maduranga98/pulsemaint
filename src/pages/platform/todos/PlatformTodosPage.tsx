import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bug, Building2, Circle, CheckCircle2, ExternalLink, FlaskConical, Pencil, PhoneCall, Plus, Trash2 } from 'lucide-react';
import type { Lead } from '@/lib/platform/leads';
import { TODO_BUCKET_LABEL, TODO_KIND_LABEL, groupTodos, type Todo, type TodoKind } from '@/lib/platform/todos';
import { subscribeLeads } from '@/services/platformLeadsService';
import { deleteTodo, failTestingTodo, setTodoDone, subscribeTodos } from '@/services/platformTodosService';
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
  const [params, setParams] = useSearchParams();
  const tab: 'open' | 'done' = params.get('tab') === 'done' ? 'done' : 'open';
  const [editing, setEditing] = useState<Todo | 'new' | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeTodos(setTodos, (e) => setError(e.message)), []);
  useEffect(() => subscribeLeads(setLeads, () => {}), []);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const groups = useMemo(() => groupTodos((todos ?? []).filter((t) => (!kind || t.kind === kind) && t.done === (tab === 'done')), now), [todos, kind, tab, now]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { '': 0, reminder: 0, task: 0, testing: 0, open: 0, done: 0 };
    for (const t of todos ?? []) {
      c[t.done ? 'done' : 'open']++;
      if (t.done === (tab === 'done')) { c['']++; c[t.kind]++; }
    }
    return c;
  }, [todos, tab]);

  async function toggle(t: Todo) {
    await setTodoDone(t, !t.done).catch((e) => setError(e.message));
  }

  async function testFailed(t: Todo) {
    if (!window.confirm('Testing failed? The feature request goes back to In progress and this testing to-do is removed.')) return;
    await failTestingTodo(t).catch((e) => setError(e.message));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="To-Do"
        subtitle="Reminders, linked to a lead (call) or company where relevant. Testing to-dos close their feature request when marked done; the bug button sends it back to In progress."
        actions={<button className={`${btn.primary} inline-flex items-center gap-1.5`} onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> New to-do</button>}
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:border-b sm:border-[#1E3A5F]">
        <div className="flex gap-1 border-b border-[#1E3A5F] sm:border-0" role="tablist">
          {([['open', 'Open'], ['done', 'Done']] as const).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={tab === v} onClick={() => setParams(v === 'open' ? {} : { tab: v }, { replace: true })}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm font-semibold ${tab === v ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              {l}
              <span className={`rounded-full px-1.5 text-[11px] font-bold leading-[18px] ${tab === v ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{counts[v]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 sm:pb-2.5">
          {([['', 'All'], ['reminder', 'Reminders'], ['task', 'Tasks'], ['testing', 'Testing']] as const).map(([v, l]) => (
            <button key={l} onClick={() => setKind(v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${kind === v ? 'border-blue-500 bg-blue-600/20 text-blue-200' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
              {l}<span className="text-[10px] font-bold opacity-70">{counts[v]}</span>
            </button>
          ))}
        </div>
      </div>

      {!todos && !error ? <Loading /> : groups.length === 0 ? (
        <p className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-8 text-center text-sm text-slate-400">{tab === 'done' ? 'Nothing done yet.' : 'Nothing to do. Add a reminder for your next call-back.'}</p>
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
                  {t.notes && <p className="mt-0.5! whitespace-pre-wrap text-sm text-slate-400">{t.notes}</p>}
                  {t.howToTest && (
                    <div className="mt-2! text-sm">
                      <p className="text-slate-400">How to test:</p>
                      <p className="whitespace-pre-wrap text-slate-200">{t.howToTest}</p>
                    </div>
                  )}
                  <p className="mt-1! flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-600 px-1.5 text-[10px]">{TODO_KIND_LABEL[t.kind]}</span>
                    {t.dueAt && <span className={!t.done && t.dueAt < now ? 'text-red-300' : ''}>{fmtDateTime(t.dueAt)}</span>}
                    {t.leadId && <Link to={`/platform/leads?lead=${t.leadId}`} className="inline-flex items-center gap-1 text-sky-300!"><PhoneCall className="h-3 w-3" />{t.leadName ?? 'Lead'}</Link>}
                    {t.companyId && <Link to={`/platform/companies/${t.companyId}`} className="inline-flex items-center gap-1 text-sky-300!"><Building2 className="h-3 w-3" />{t.companyName ?? 'Company'}</Link>}
                    {t.featureRequestId && <Link to="/platform/feature-requests" className="inline-flex items-center gap-1 text-violet-300!"><ExternalLink className="h-3 w-3" />Feature request</Link>}
                  </p>
                </div>
                <div className="flex shrink-0 text-slate-400">
                  {t.kind === 'testing' && t.featureRequestId && !t.done && (
                    <button title="Testing failed — send the feature request back to In progress" className="rounded p-1.5 text-red-400 hover:bg-slate-800" onClick={() => void testFailed(t)}><Bug className="h-4 w-4" /></button>
                  )}
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
