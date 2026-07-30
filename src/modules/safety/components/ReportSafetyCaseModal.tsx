import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { createSafetyCase } from '@/services/safety.service';
import {
  SAFETY_CASE_SEVERITIES,
  SAFETY_CASE_TYPES,
  type SafetyCaseSeverity,
  type SafetyCaseType,
} from '@/types/safety';

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

const field = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] outline-none focus:border-[#1A56DB]';
const labelCls = 'block text-xs font-medium text-[#8BA3BF] mb-1';

export default function ReportSafetyCaseModal({ onClose, onCreated }: Props) {
  const profile = useAuthStore((s) => s.userProfile);
  const toast = useToast();
  const [type, setType] = useState<SafetyCaseType>('near_miss');
  const [severity, setSeverity] = useState<SafetyCaseSeverity>('medium');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!profile?.companyId) return;
    if (!title.trim()) {
      toast.error('Give the case a short title.');
      return;
    }
    setSaving(true);
    try {
      await createSafetyCase({
        companyId: profile.companyId,
        siteId: profile.siteIds?.[0] || profile.companyId,
        type,
        title: title.trim(),
        description: description.trim(),
        severity,
        status: 'open',
        location: location.trim(),
        machineId: null,
        machineName: null,
        correctiveAction: correctiveAction.trim(),
        reportedBy: profile.id,
        reportedByName: profile.fullName ?? '',
        reportedByRole: profile.role ?? '',
      });
      toast.success('Safety case logged.');
      onCreated?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to log safety case.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-[Sora] text-lg font-bold text-[#F0F4F8]">Report Safety Case</h2>
          <button type="button" onClick={onClose} className="text-[#8BA3BF] hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as SafetyCaseType)} className={field}>
                {SAFETY_CASE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as SafetyCaseSeverity)} className={field}>
                {SAFETY_CASE_SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Slip hazard near packing line" className={field} />
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Area / machine" className={field} />
          </div>
          <div>
            <label className={labelCls}>What happened?</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={field} />
          </div>
          <div>
            <label className={labelCls}>Immediate corrective action</label>
            <textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={2} className={field} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#1E3A5F] px-4 py-2 text-sm font-semibold text-[#8BA3BF] hover:text-white">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Log Case'}
          </button>
        </div>
      </div>
    </div>
  );
}
