import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Bug, CheckCircle2, CircleCheck, Lightbulb, ListTodo, PhoneCall, Play, Plus, Trash2, X } from 'lucide-react';
import type { Lead } from '@/lib/platform/leads';
import {
  FEATURE_REQUEST_STATUSES, FEATURE_STATUS_LABEL, createFeatureRequest, deleteFeatureRequest, subscribeFeatureRequests, subscribeLeads,
  type FeatureRequest, type FeatureRequestStatus, type FeatureRequestType,
} from '@/services/platformLeadsService';
import { ErrorNote, Loading, PageHeader, btn, fmtDate, input } from '../platformUi';
import { Field, Modal } from './leadUi';
import { moveFeatureRequestToTesting, startFeatureRequest } from '@/services/platformTodosService';
import { useCompanyOptions, type CompanyOption } from '../useCompanyOptions';
import { markFeatureRequestsSeen } from '@/lib/platform/useNavBadges';

const STATUS_TONE: Record<FeatureRequestStatus, string> = {
  requested: 'border-slate-600 text-slate-300', in_progress: 'border-amber-600/60 text-amber-300', testing: 'border-violet-500/60 text-violet-300', closed: 'border-emerald-600/60 text-emerald-300',
};

/**
 * Features and bugs raised on lead/customer calls or while testing. Each one
 * moves forward with one button at a time: Requested → Start → In progress →
 * "Close — move to testing" (asks for testing instructions and adds a testing
 * to-do) → Testing → closed automatically when that to-do is ticked on To-Do.
 */
export default function PlatformFeatureRequestsPage() {
  const [rows, setRows] = useState<FeatureRequest[] | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState('');
  const [type, setType] = useState<'' | FeatureRequestType>('');
  const [status, setStatus] = useState<'' | FeatureRequestStatus>('');
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<FeatureRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const companies = useCompanyOptions();

  useEffect(() => subscribeFeatureRequests(setRows, (e) => setError(e.message)), []);
  // Opening the page clears the nav badge; leaving it too (covers requests that arrived while it was open).
  useEffect(() => {
    markFeatureRequestsSeen();
    return markFeatureRequestsSeen;
  }, []);
  useEffect(() => subscribeLeads(setLeads, () => {}), []);

  const filtered = useMemo(() => (rows ?? []).filter((r) => (!type || r.type === type) && (!status || r.status === status)), [rows, type, status]);

  async function start(r: FeatureRequest) {
    setBusyId(r.id);
    await startFeatureRequest(r.id).catch((e) => setError(e.message));
    setBusyId(null);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Feature requests"
        subtitle="Feature requests and bugs — from here, from a customer's call, or from testing. Closing hands it to Testing in the To-Do list; ticking that to-do closes the request."
        actions={<button className={`${btn.primary} inline-flex items-center gap-1.5`} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New request</button>}
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {([['', 'All types'], ['feature', 'Feature'], ['bug', 'Bug']] as const).map(([v, l]) => <Chip key={l} on={type === v} onClick={() => setType(v)}>{l}</Chip>)}
        <span className="mx-1" />
        {([['', 'All statuses'], ...FEATURE_REQUEST_STATUSES.map((s) => [s, FEATURE_STATUS_LABEL[s]])] as [typeof status, string][]).map(([v, l]) => (
          <Chip key={l} on={status === v} onClick={() => setStatus(v)}>{l}</Chip>
        ))}
      </div>
      {!rows && !error ? <Loading /> : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-[10px] font-semibold ${r.type === 'bug' ? 'border-red-600/60 text-red-300' : 'border-sky-600/60 text-sky-300'}`}>
                      {r.type === 'bug' ? <Bug className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />}{r.type === 'bug' ? 'Bug' : 'Feature'}
                    </span>
                    <span className={`rounded-full border px-2 py-px text-[10px] font-semibold ${STATUS_TONE[r.status]}`}>{FEATURE_STATUS_LABEL[r.status]}</span>
                  </div>
                  <p className="mt-1! font-semibold text-white">{r.title}</p>
                  {r.description && <p className="mt-0.5! whitespace-pre-wrap text-sm text-slate-300">{r.description}</p>}
                  <p className="mt-1! flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{fmtDate(r.createdAt)}{r.createdByEmail && ` · ${r.createdByEmail}`}</span>
                    {r.leadId && <Link to={`/platform/leads?lead=${r.leadId}`} className="inline-flex items-center gap-1 text-sky-300!"><PhoneCall className="h-3 w-3" />{r.leadName}</Link>}
                    {r.companyId && <Link to={`/platform/companies/${r.companyId}`} className="inline-flex items-center gap-1 text-sky-300!"><Building2 className="h-3 w-3" />{r.companyName}</Link>}
                    {(r.status === 'testing' || r.status === 'closed') && (
                      <Link to={`/platform/todos?tab=${r.status === 'closed' ? 'done' : 'open'}`} className="inline-flex items-center gap-1 text-emerald-300!"><ListTodo className="h-3 w-3" />Testing to-do</Link>
                    )}
                    {r.howToTest && <span className="text-slate-400">How to test: {r.howToTest}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-slate-400">
                  {r.status === 'requested' && (
                    <button title="Start — move to In progress" disabled={busyId === r.id} className="rounded p-1.5 text-amber-300 hover:bg-slate-800 disabled:opacity-50" onClick={() => void start(r)}>
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {r.status === 'in_progress' && (
                    <button title="Close — move to testing" className="rounded p-1.5 text-violet-300 hover:bg-slate-800" onClick={() => setTesting(r)}>
                      <CircleCheck className="h-4 w-4" />
                    </button>
                  )}
                  {r.status === 'closed' && <CheckCircle2 className="mx-1.5 h-4 w-4 text-emerald-400" aria-label="Closed" />}
                  <button title="Delete" className="rounded p-1.5 hover:bg-slate-800 hover:text-white" onClick={() => window.confirm('Delete this request?') && void deleteFeatureRequest(r.id).catch((e) => setError(e.message))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-8 text-center text-sm text-slate-400">Nothing here.</p>}
        </div>
      )}

      {creating && <NewRequestDialog leads={leads} companies={companies} onClose={() => setCreating(false)} onError={setError} />}
      {testing && <TestingDialog request={testing} onClose={() => setTesting(null)} onError={setError} />}
    </div>
  );
}

function NewRequestDialog({ leads, companies, onClose, onError }: { leads: Lead[]; companies: CompanyOption[]; onClose: () => void; onError: (m: string) => void }) {
  const [type, setType] = useState<FeatureRequestType>('feature');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [leadId, setLeadId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => leads.filter((l) => !l.archived).sort((a, b) => a.businessName.localeCompare(b.businessName)), [leads]);

  async function save() {
    const lead = leads.find((l) => l.id === leadId) ?? null;
    const company = companies.find((c) => c.id === companyId) ?? null;
    const raisedBy = lead?.businessName ?? company?.name;
    if (!title.trim() && !raisedBy) return;
    setBusy(true);
    try {
      await createFeatureRequest({ type, title: title.trim() || `${type === 'bug' ? 'Bug reported' : 'Feature requested'} by ${raisedBy}`, description, lead, company });
      onClose();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New feature request / bug" onClose={onClose} footer={<>
      <button className={btn.ghost} onClick={onClose}>Cancel</button>
      <button className={btn.primary} disabled={busy || (!title.trim() && !leadId && !companyId)} onClick={() => void save()}>Save</button>
    </>}>
      <div className="space-y-3">
        <div className="flex gap-1.5">{(['feature', 'bug'] as const).map((t) => <Chip key={t} on={type === t} onClick={() => setType(t)}>{t === 'bug' ? 'Bug' : 'Feature'}</Chip>)}</div>
        <Field label="Title"><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
        <Field label="Details"><textarea className={input} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company (optional)" hint="The customer company that asked for it or hit the bug.">
            <select className={input} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">—</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Raised by lead (optional)" hint="Tags the lead with Feature/Bug so it shows on the board.">
            <select className={input} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              <option value="">—</option>{options.map((l) => <option key={l.id} value={l.id}>{l.businessName}</option>)}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function TestingDialog({ request, onClose, onError }: { request: FeatureRequest; onClose: () => void; onError: (m: string) => void }) {
  const [howToTest, setHowToTest] = useState(request.howToTest);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!howToTest.trim()) return;
    setBusy(true);
    try {
      await moveFeatureRequestToTesting(request, howToTest);
      onClose();
    } catch (e) {
      onError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal title={<><CircleCheck className="h-4 w-4 text-violet-300" /> Close — move to testing</>} onClose={onClose} footer={<>
      <button className={`${btn.ghost} inline-flex items-center gap-1.5`} onClick={onClose}><X className="h-4 w-4" /> Cancel</button>
      <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50" disabled={busy || !howToTest.trim()} onClick={() => void save()}>
        {busy ? 'Moving…' : 'Move to testing'}
      </button>
    </>}>
      <Field label="Testing instructions *" hint="How to actually test this — the steps, not a link or file path. A testing to-do is created automatically.">
        <textarea className={input} rows={4} value={howToTest} onChange={(e) => setHowToTest(e.target.value)} autoFocus
          placeholder="e.g. Go to Work orders → open any work order → tap Export → check the PDF downloads with the notes section included." />
      </Field>
    </Modal>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>{children}</button>;
}
