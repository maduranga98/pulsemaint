import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MessageSquarePlus, Send } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { PROVIDER } from '@/lib/legal/terms';
import {
  SUPPORT_REQUEST_TYPES, addSupportMessage, createSupportRequest, subscribeCompanyRequests, subscribeMessages,
  type SupportMessage, type SupportRequest, type SupportRequestType,
} from '@/services/supportRequestsService';

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  in_progress: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  resolved: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  closed: 'bg-slate-800 text-slate-300 border-slate-600',
};

const when = (ts: { toDate?: () => Date } | null | undefined) =>
  ts?.toDate ? ts.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

const field = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none';

/**
 * Company admins send feedback, feature ideas and special requests to
 * Lumora Ventures (the FirmiCore team) and follow the replies here.
 */
export default function SupportRequestsPage() {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  const profile = useAuthStore((s) => s.userProfile);
  const [rows, setRows] = useState<SupportRequest[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [type, setType] = useState<SupportRequestType>('feedback');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!company?.id) return undefined;
    return subscribeCompanyRequests(company.id, setRows, () => setError(t('common.supportRequests.errors.load')));
  }, [company?.id, t]);

  async function submit() {
    if (!company || !profile || !subject.trim() || !message.trim()) return;
    setBusy(true);
    setError('');
    try {
      await createSupportRequest({
        companyId: company.id, companyName: company.name, uid: profile.id, name: profile.fullName, email: profile.email,
        type, subject, message,
      });
      setSubject('');
      setMessage('');
      setComposing(false);
      setNotice(t('common.supportRequests.sent'));
    } catch {
      setError(t('common.supportRequests.errors.send'));
    } finally {
      setBusy(false);
    }
  }

  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <div className="-mx-4 -mt-5 border-b border-[#1E3A5F] bg-[#0F1E35] px-4 py-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white!">{t('common.supportRequests.title')}</h1>
            <p className="mt-1 text-sm text-slate-400">{t('common.supportRequests.subtitle')}</p>
          </div>
          {!composing && !open && (
            <button onClick={() => { setComposing(true); setNotice(''); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white! hover:bg-blue-500">
              <MessageSquarePlus className="h-4 w-4" /> {t('common.supportRequests.new')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-300">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-4 text-sm text-emerald-300">{notice}</div>}

      {composing && (
        <div className="space-y-4 rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-5">
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('common.supportRequests.form.type')}</label>
            <select className={field} value={type} onChange={(e) => setType(e.target.value as SupportRequestType)}>
              {SUPPORT_REQUEST_TYPES.map((k) => <option key={k} value={k}>{t(`common.supportRequests.types.${k}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('common.supportRequests.form.subject')}</label>
            <input className={field} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">{t('common.supportRequests.form.message')}</label>
            <textarea className={`${field} h-36`} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('common.supportRequests.form.placeholder')} />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setComposing(false)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">{t('common.actions.cancel')}</button>
            <button onClick={() => void submit()} disabled={busy || !subject.trim() || !message.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white! hover:bg-blue-500 disabled:opacity-50">
              <Send className="h-4 w-4" /> {busy ? t('common.supportRequests.sending') : t('common.supportRequests.send')}
            </button>
          </div>
        </div>
      )}

      {open ? (
        <RequestThread request={open} onBack={() => setOpenId(null)} />
      ) : !composing && (
        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-8 text-center text-sm text-slate-400">{t('common.supportRequests.empty')}</p>
          )}
          {rows.map((r) => (
            <button key={r.id} onClick={() => setOpenId(r.id)} className="block w-full rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4 text-left hover:border-blue-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">{r.subject}</p>
                <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_STYLE[r.status] ?? STATUS_STYLE.closed}`}>
                  {t(`common.supportRequests.statuses.${r.status}`)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {t(`common.supportRequests.types.${r.type}`)} · {r.createdByName} · {when(r.createdAt)}
                {r.lastMessageBy === 'lumora' && <span className="ml-2 text-blue-300">{t('common.supportRequests.newReply')}</span>}
              </p>
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-slate-500">
        {t('common.supportRequests.contact')} <a className="underline" href={`mailto:${PROVIDER.email}`}>{PROVIDER.email}</a> · {PROVIDER.phone}
      </p>
    </div>
  );
}

function RequestThread({ request, onBack }: { request: SupportRequest; onBack: () => void }) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => subscribeMessages(request.id, setMessages), [request.id]);

  async function send() {
    if (!profile || !reply.trim()) return;
    setBusy(true);
    setError('');
    try {
      await addSupportMessage(request.id, { type: 'company', uid: profile.id, name: profile.fullName }, reply);
      setReply('');
    } catch {
      setError(t('common.supportRequests.errors.send'));
    } finally {
      setBusy(false);
    }
  }

  const closed = request.status === 'closed';
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-blue-300! hover:underline"><ArrowLeft className="h-4 w-4" /> {t('common.supportRequests.back')}</button>
      <div className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white!">{request.subject}</h2>
          <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_STYLE[request.status] ?? STATUS_STYLE.closed}`}>{t(`common.supportRequests.statuses.${request.status}`)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">{t(`common.supportRequests.types.${request.type}`)} · {request.createdByName} · {when(request.createdAt)}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">{request.message}</p>
      </div>
      {messages.map((m) => (
        <div key={m.id} className={`rounded-xl border p-4 ${m.authorType === 'lumora' ? 'border-blue-800/60 bg-blue-900/20' : 'ml-auto max-w-3xl border-[#1E3A5F] bg-[#0F1E35]'}`}>
          <p className="mb-1 text-xs text-slate-400">{m.authorType === 'lumora' ? t('common.supportRequests.lumoraTeam') : m.authorName} · {when(m.createdAt)}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-200">{m.body}</p>
        </div>
      ))}
      {error && <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">{error}</div>}
      {!closed && (
        <div className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
          <textarea className={`${field} h-24`} value={reply} maxLength={5000} onChange={(e) => setReply(e.target.value)} placeholder={t('common.supportRequests.replyPlaceholder')} />
          <div className="mt-3 flex justify-end">
            <button onClick={() => void send()} disabled={busy || !reply.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white! hover:bg-blue-500 disabled:opacity-50">
              <Send className="h-4 w-4" /> {busy ? t('common.supportRequests.sending') : t('common.supportRequests.reply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
