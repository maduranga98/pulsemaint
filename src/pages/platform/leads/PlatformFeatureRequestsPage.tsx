import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Bug, CheckCircle2, Lightbulb, PhoneCall, Play, Plus, Trash2 } from 'lucide-react';
import type { Lead } from '@/lib/platform/leads';
import {
  FEATURE_REQUEST_STATUSES, FEATURE_STATUS_LABEL, createFeatureRequest, deleteFeatureRequest, subscribeFeatureRequests, subscribeLeads,
  type FeatureRequest, type FeatureRequestStatus, type FeatureRequestType,
} from '@/services/platformLeadsService';
import { ErrorNote, Loading, PageHeader, btn, fmtDate, input } from '../platformUi';
import { Field, Modal } from './leadUi';
import { moveFeatureRequestToTesting, setFeatureRequestStatus } from '@/services/platformTodosService';
import { useCompanyOptions, type CompanyOption } from '../useCompanyOptions';
import { markFeatureRequestsSeen } from '@/lib/platform/useNavBadges';

const STATUS_TONE: Record<FeatureRequestStatus, string> = {
  requested: 'border-slate-600 text-slate-300', in_progress: 'border-amber-600/60 text-amber-300', testing: 'border-sky-600/60 text-sky-300', closed: 'border-emerald-600/60 text-emerald-300',
};
const NEXT: Partial<Record<FeatureRequestStatus, FeatureRequestStatus>> = { requested: 'in_progress', in_progress: 'testing', testing: 'closed' };

/** Features and bugs raised on lead/customer calls or while testing, worked Requested → In progress → Testing → Closed. */
export default function PlatformFeatureRequestsPage() {
  const [rows, setRows] = useState<FeatureRequest[] | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState('');
  const [type, setType] = useState<'' | FeatureRequestType>('');
  const [status, setStatus] = useState<'' | 'active' | FeatureRequestStatus>('active');
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState<FeatureRequest | null>(null);
  const companies = useCompanyOptions();

  useEffect(() => subscribeFeatureRequests(setRows, (e) => setError(e.message)), []);
  // Opening the page clears the nav badge; leaving it too (covers requests that arrived while it was open).
  useEffect(() => {
    markFeatureRequestsSeen();
    return markFeatureRequestsSeen;
  }, []);
  useEffect(() => subscribeLeads(setLeads, () => {}), []);

  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (!type || r.type === type) && (!status || (status === 'active' ? r.status !== 'closed' : r.status === status))), [rows, type, status]);

  async function advance(r: FeatureRequest) {
    const next = NEXT[r.status];
    if (!next) return;
    if (next === 'testing') {
      setTesting(r);
      return;
    }
    if (next === 'closed' && !window.confirm('Close this request? Its open testing to-do is marked done too.')) return;
    await setFeatureRequestStatus(r.id, next).catch((e) => setError(e.message));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Feature requests"
        subtitle="Features and bugs from lead and customer calls, or found in testing. Moving one to Testing asks how to verify it and adds a testing to-do; ticking that to-do closes the request."
        actions={<button className={`${btn.primary} inline-flex items-center gap-1.5`} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New request</button>}
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {([['', 'All types'], ['feature', 'Feature'], ['bug', 'Bug']] as const).map(([v, l]) => <Chip key={l} on={type === v} onClick={() => setType(v)}>{l}</Chip>)}
        <span className="mx-1" />
        {([['active', 'Open'], ['', 'All'], ...FEATURE_REQUEST_STATUSES.map((s) => [s, FEATURE_STATUS_LABEL[s]])] as [typeof status, string][]).map(([v, l]) => (
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
                  <p className="mt-1 font-semibold text-white">{r.title}</p>
                  {r.description && <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-300">{r.description}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {fmtDate(r.createdAt)}{r.createdByEmail && ` · ${r.createdByEmail}`}
                    {r.leadId && <Link to={`/platform/leads?lead=${r.leadId}`} className="inline-flex items-center gap-1 text-sky-300!"><PhoneCall className="h-3 w-3" />{r.leadName}</Link>}
                    {r.companyId && <Link to={`/platform/companies/${r.companyId}`} className="inline-flex items-center gap-1 text-sky-300!"><Building2 className="h-3 w-3" />{r.companyName}</Link>}
                    {r.howToTest && <span className="text-slate-400">How to test: {r.howToTest}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-slate-400">
                  <select className="rounded border border-[#1E3A5F] bg-[#0A1628] px-1.5 py-1 text-xs text-slate-200" value={r.status}
                    onChange={(e) => {
                      const s = e.target.value as FeatureRequestStatus;
                      if (s === 'testing') setTesting(r);
                      else void setFeatureRequestStatus(r.id, s).catch((err) => setError(err.message));
                    }}>
                    {FEATURE_REQUEST_STATUSES.map((s) => <option key={s} value={s}>{FEATURE_STATUS_LABEL[s]}</option>)}
                  </select>
                  {NEXT[r.status] && (
                    <button title={`Move to ${FEATURE_STATUS_LABEL[NEXT[r.status]!]}`} className="rounded p-1.5 text-amber-300 hover:bg-slate-800" onClick={() => void advance(r)}>
                      {r.status === 'testing' ? <CheckCircle2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                  )}
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
  return (
    <Modal title="Move to Testing" onClose={onClose} footer={<>
      <button className={btn.ghost} onClick={onClose}>Cancel</button>
      <button className={btn.primary} onClick={() => void moveFeatureRequestToTesting(request, howToTest).then(onClose).catch((e) => onError(e.message))}>Move to Testing</button>
    </>}>
      <p className="mb-3 text-sm text-slate-400">A testing to-do (due tomorrow) is added to To-Do. Ticking it when the test passes closes this request.</p>
      <Field label="How to test" hint="Where to click to verify it — e.g. Settings → Teams → toggle.">
        <textarea className={input} rows={3} value={howToTest} onChange={(e) => setHowToTest(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>{children}</button>;
}
