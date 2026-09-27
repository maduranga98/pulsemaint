import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformService, errorText, type PlatformReminder } from '@/services/platformService';
import { Badge, ErrorNote, Loading, PageHeader, PLAN_NAMES, btn, fmtDate, fmtDateTime, relDays, statusTone } from './platformUi';

const LABEL: Record<PlatformReminder['kind'], string> = {
  paymentFailed: 'Payment failed / overdue',
  cancelling: 'Subscription ending',
  renewalDue: 'Renewal due',
  trialEnding: 'Trial ending',
  trialExpired: 'Trial ended',
};

export default function PlatformRemindersPage() {
  const [rows, setRows] = useState<PlatformReminder[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(() => {
    platformService.listReminders().then((r) => setRows(r.reminders)).catch((e) => setError(errorText(e, 'Could not load reminders')));
  }, []);
  useEffect(load, [load]);

  async function send(r: PlatformReminder) {
    const key = `${r.companyId}-${r.kind}`;
    setSending(key);
    setError('');
    setNotice('');
    try {
      const res = await platformService.sendReminder(r.companyId, r.kind);
      setNotice(`Reminder sent to ${res.to}`);
      load();
    } catch (e) {
      setError(errorText(e, 'Could not send the reminder'));
    } finally {
      setSending(null);
    }
  }

  return (
    <div>
      <PageHeader title="Payment reminders" subtitle="Companies that need a payment follow-up. A daily digest of this list is also emailed to Lumora Ventures at 08:30 (Sri Lanka time)." />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {notice && <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-emerald-300">{notice}</div>}
      {!rows && !error ? <Loading /> : rows && rows.length === 0 ? (
        <p className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-8 text-center text-sm text-slate-400">Nothing needs a follow-up right now.</p>
      ) : (
        <div className="space-y-2">
          {rows?.map((r) => (
            <div key={`${r.companyId}-${r.kind}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(r.severity)}>{r.severity}</Badge>
                  <Link to={`/platform/companies/${r.companyId}`} className="font-semibold text-blue-300! hover:underline">{r.companyName}</Link>
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  {LABEL[r.kind]} · {PLAN_NAMES[r.plan] ?? r.plan} ({r.billingCycle}) · {fmtDate(r.dueAt)} <span className="text-slate-500">{relDays(r.dueAt)}</span>
                </p>
                <p className="text-xs text-slate-500">Last reminder: {fmtDateTime(r.lastReminderAt)}</p>
              </div>
              <button className={btn.primary} disabled={sending !== null} onClick={() => void send(r)}>
                {sending === `${r.companyId}-${r.kind}` ? 'Sending…' : 'Email reminder'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
