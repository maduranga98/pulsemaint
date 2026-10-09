import { useState } from 'react';
import { btn, input } from './platformUi';

/** Ask for an optional reason before declining a company registration (it is emailed to the admin). */
export default function RejectCompanyDialog({ companyName, busy, onCancel, onConfirm }: {
  companyName: string; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="w-full max-w-md space-y-4 rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-6">
        <h3 className="text-base font-semibold text-white!">Reject {companyName}?</h3>
        <p className="text-sm text-slate-400">Nobody from this company can use FirmiCore. The admin is emailed, with the reason if you add one. You can still approve it later.</p>
        <textarea className={`${input} h-28`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional) — e.g. duplicate registration, test account" autoFocus />
        <div className="flex justify-end gap-2">
          <button className={btn.ghost} onClick={onCancel}>Cancel</button>
          <button className={btn.danger} disabled={busy} onClick={() => onConfirm(reason.trim())}>{busy ? 'Rejecting…' : 'Reject registration'}</button>
        </div>
      </div>
    </div>
  );
}
