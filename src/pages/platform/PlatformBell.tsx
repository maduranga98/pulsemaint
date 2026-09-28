import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, CreditCard, MessageSquare } from 'lucide-react';
import { markPaymentAlertsRead, type PaymentAlert } from '@/lib/platform/usePaymentAlerts';
import { markSupportRequestRead, type SupportRequest } from '@/services/supportRequestsService';
import { fmtMoney } from './platformUi';

interface Props {
  paymentAlerts: PaymentAlert[];
  requests: SupportRequest[];
}

const TYPE_LABEL: Record<string, string> = {
  feedback: 'Feedback', feature: 'Feature idea', special: 'Special request', billing: 'Billing question', support: 'Support',
};

/**
 * Superadmin notification bell: FirmiCore payments received and new
 * company requests / replies, newest first. Opening an item clears it.
 */
export default function PlatformBell({ paymentAlerts, requests }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = paymentAlerts.length + requests.length;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  async function markAll() {
    await Promise.all([
      markPaymentAlertsRead(paymentAlerts.map((a) => a.id)),
      ...requests.map((r) => markSupportRequestRead(r.id, 'lumora').catch(() => {})),
    ]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-2 text-slate-300 hover:text-white"
        aria-label={`Notifications${count ? ` (${count} new)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-[#1E3A5F] bg-[#0F1E35] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#1E3A5F] px-4 py-3">
            <p className="text-sm font-semibold text-white">Notifications</p>
            {count > 0 && (
              <button onClick={() => void markAll()} className="inline-flex items-center gap-1 text-xs text-blue-300 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {count === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">You're all caught up.</p>}
            {paymentAlerts.map((a) => (
              <button
                key={a.id}
                onClick={() => { void markPaymentAlertsRead([a.id]); go('/platform/payments'); }}
                className="flex w-full items-start gap-3 border-b border-[#1E3A5F] px-4 py-3 text-left hover:bg-[#142849]"
              >
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span className="text-sm text-slate-200">
                  Payment received: <strong className="text-emerald-300">{fmtMoney(a.amount, a.currency)}</strong>
                  <span className="block text-xs text-slate-400">{a.companyName ?? 'A company'}</span>
                </span>
              </button>
            ))}
            {requests.map((r) => (
              <button
                key={r.id}
                onClick={() => go(`/platform/requests/${r.id}`)}
                className="flex w-full items-start gap-3 border-b border-[#1E3A5F] px-4 py-3 text-left hover:bg-[#142849]"
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span className="text-sm text-slate-200">
                  {r.lastMessageBy === 'company' ? 'New reply' : `New ${(TYPE_LABEL[r.type] ?? r.type).toLowerCase()}`}: {r.subject}
                  <span className="block text-xs text-slate-400">{r.companyName} · {r.createdByName}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
