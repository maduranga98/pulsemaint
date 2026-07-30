import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { createWorkPermit } from '@/services/safety.service';
import { WORK_PERMIT_CATEGORIES, type WorkPermitCategory } from '@/types/safety';

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

const field = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] outline-none focus:border-[#1A56DB]';
const labelCls = 'block text-xs font-medium text-[#8BA3BF] mb-1';

export default function NewWorkPermitModal({ onClose, onCreated }: Props) {
  const profile = useAuthStore((s) => s.userProfile);
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [category, setCategory] = useState<WorkPermitCategory>('hot_work');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [validFrom, setValidFrom] = useState(today);
  const [validTo, setValidTo] = useState(today);
  const [hazards, setHazards] = useState('');
  const [ppeRequired, setPpeRequired] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const categoryDef = useMemo(
    () => WORK_PERMIT_CATEGORIES.find((c) => c.value === category)!,
    [category],
  );

  async function submit() {
    if (!profile?.companyId) return;
    if (!title.trim()) {
      toast.error('Give the permit a title.');
      return;
    }
    if (validTo < validFrom) {
      toast.error('"Valid to" must be on or after "Valid from".');
      return;
    }
    setSaving(true);
    try {
      await createWorkPermit({
        companyId: profile.companyId,
        siteId: profile.siteIds?.[0] || profile.companyId,
        category,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        machineId: null,
        status: 'active',
        validFrom,
        validTo,
        hazards: hazards.trim(),
        precautions: categoryDef.precautions.filter((p) => checked[p]),
        ppeRequired: ppeRequired.trim(),
        requestedBy: profile.id,
        requestedByName: profile.fullName ?? '',
        requestedByRole: profile.role ?? '',
      });
      toast.success('Work permit issued.');
      onCreated?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to issue permit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-[Sora] text-lg font-bold text-[#F0F4F8]">New Work Permit</h2>
          <button type="button" onClick={onClose} className="text-[#8BA3BF] hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className={labelCls}>Permit Category</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value as WorkPermitCategory); setChecked({}); }}
              className={field}
            >
              {WORK_PERMIT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Work to be done" className={field} />
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Area / machine" className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Valid from</label>
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={field} />
            </div>
            <div>
              <label className={labelCls}>Valid to</label>
              <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={field} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description of work</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={field} />
          </div>
          <div>
            <label className={labelCls}>Hazards identified</label>
            <textarea value={hazards} onChange={(e) => setHazards(e.target.value)} rows={2} className={field} />
          </div>

          {/* Category-specific precautions */}
          <div>
            <p className={labelCls}>Precautions in place</p>
            <div className="space-y-1.5 rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3">
              {categoryDef.precautions.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm text-[#F0F4F8]">
                  <input
                    type="checkbox"
                    checked={!!checked[p]}
                    onChange={(e) => setChecked((prev) => ({ ...prev, [p]: e.target.checked }))}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>PPE required</label>
            <input value={ppeRequired} onChange={(e) => setPpeRequired(e.target.value)} placeholder="e.g. Helmet, gloves, harness" className={field} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#1E3A5F] px-4 py-2 text-sm font-semibold text-[#8BA3BF] hover:text-white">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Issue Permit'}
          </button>
        </div>
      </div>
    </div>
  );
}
