import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/firebase';
import {
  SUPPORT_REQUEST_STATUSES, addSupportMessage, setSupportRequestStatus, subscribeAllRequests, subscribeMessages, subscribeRequest,
  type SupportMessage, type SupportRequest, type SupportRequestStatus,
} from '@/services/supportRequestsService';
import { Badge, Card, ErrorNote, Loading, PageHeader, btn, fmtDateTime, input, statusTone } from './platformUi';

const ms = (ts: { toMillis?: () => number } | null | undefined) => ts?.toMillis?.() ?? null;

/** Feedback, feature ideas and special requests sent by company admins. */
export function PlatformRequestsPage() {
  const [rows, setRows] = useState<SupportRequest[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | SupportRequestStatus>('active');
  const [type, setType] = useState('all');

  useEffect(() => subscribeAllRequests(setRows, (e) => setError(e.message)), []);

  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (status === 'all' || (status === 'active' ? ['open', 'in_progress'].includes(r.status) : r.status === status))
    && (type === 'all' || r.type === type)), [rows, status, type]);

  return (
    <div>
      <PageHeader title="Requests & feedback" subtitle="Sent by company admins from FirmiCore (Admin → Feedback & Requests)." />
      {error && <ErrorNote message={error} />}
      <div className="mb-4 flex flex-wrap gap-3">
        <select className={`${input} w-auto!`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="active">Open & in progress</option><option value="all">All</option>
          {SUPPORT_REQUEST_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className={`${input} w-auto!`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option><option value="feedback">Feedback</option><option value="feature">Feature idea</option>
          <option value="special">Special request</option><option value="billing">Billing</option><option value="support">Support</option>
        </select>
      </div>
      {!rows && !error ? <Loading /> : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Link key={r.id} to={`/platform/requests/${r.id}`} className="block rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4 hover:border-blue-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">{r.subject}</p>
                <span className="flex gap-2"><Badge>{r.type}</Badge><Badge tone={statusTone(r.status)}>{r.status.replace('_', ' ')}</Badge>
                  {r.lastMessageBy === 'company' && r.status !== 'closed' && <Badge tone="amber">awaiting reply</Badge>}</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{r.companyName} · {r.createdByName} · {fmtDateTime(ms(r.createdAt))}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-300">{r.message}</p>
            </Link>
          ))}
          {filtered.length === 0 && <p className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-8 text-center text-sm text-slate-400">No requests.</p>}
        </div>
      )}
    </div>
  );
}

export function PlatformRequestDetailPage() {
  const { requestId = '' } = useParams();
  const [req, setReq] = useState<SupportRequest | null | undefined>(undefined);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => subscribeRequest(requestId, setReq), [requestId]);
  useEffect(() => subscribeMessages(requestId, setMessages), [requestId]);

  async function send() {
    if (!reply.trim() || !auth.currentUser) return;
    setBusy(true);
    setError('');
    try {
      await addSupportMessage(requestId, { type: 'lumora', uid: auth.currentUser.uid, name: 'Lumora Ventures' }, reply);
      if (req?.status === 'open') await setSupportRequestStatus(requestId, 'in_progress');
      setReply('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (req === undefined) return <Loading />;
  if (req === null) return <ErrorNote message="Request not found" />;

  return (
    <div className="space-y-5">
      <Link to="/platform/requests" className="inline-flex items-center gap-1.5 text-sm text-blue-300! hover:underline"><ArrowLeft className="h-4 w-4" /> Requests</Link>
      <PageHeader
        title={req.subject}
        subtitle={`${req.type} · ${req.companyName} · ${req.createdByName}${req.createdByEmail ? ` <${req.createdByEmail}>` : ''} · ${fmtDateTime(ms(req.createdAt))}`}
        actions={
          <select className={`${input} w-auto!`} value={req.status} onChange={(e) => void setSupportRequestStatus(requestId, e.target.value as SupportRequestStatus)}>
            {SUPPORT_REQUEST_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        }
      />
      <Link to={`/platform/companies/${req.companyId}`} className="text-sm text-blue-300! hover:underline">Open company →</Link>
      <Card>
        <p className="whitespace-pre-wrap text-sm text-slate-200">{req.message}</p>
      </Card>
      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`max-w-3xl rounded-xl border p-4 ${m.authorType === 'lumora' ? 'ml-auto border-blue-800/60 bg-blue-900/20' : 'border-[#1E3A5F] bg-[#0F1E35]'}`}>
            <p className="mb-1 text-xs text-slate-400">{m.authorName} · {fmtDateTime(ms(m.createdAt))}</p>
            <p className="whitespace-pre-wrap text-sm text-slate-200">{m.body}</p>
          </div>
        ))}
      </div>
      {error && <ErrorNote message={error} />}
      <Card title="Reply to the company">
        <textarea className={`${input} h-28`} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Your reply is emailed to the company admin who sent the request." />
        <div className="mt-3 flex justify-end">
          <button className={btn.primary} disabled={busy || !reply.trim()} onClick={() => void send()}>{busy ? 'Sending…' : 'Send reply'}</button>
        </div>
      </Card>
    </div>
  );
}
