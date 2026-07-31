import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { createWorkPermit } from '@/services/safety.service';
import { WORK_PERMIT_CATEGORIES, type WorkPermitCategory } from '@/types/safety';

interface Props {
  onClose: () => void;
  onCreated?: () => void;
  /** Pre-select a work order (e.g. when opened from a WO). */
  presetWorkOrderId?: string;
}

const field = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] outline-none focus:border-[#1A56DB]';
const labelCls = 'block text-xs font-medium text-[#8BA3BF] mb-1';

// Work orders that haven't finished yet are the ones a permit is raised for.
const OPEN_WO_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'] as const;

export default function NewWorkPermitModal({ onClose, onCreated, presetWorkOrderId }: Props) {
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const toast = useToast();
  // Local 'YYYY-MM-DDTHH:mm' for <input type="datetime-local">, defaulting to now.
  const nowLocal = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  })();

  const [category, setCategory] = useState<WorkPermitCategory>('hot_work');
  const [workOrderId, setWorkOrderId] = useState(presetWorkOrderId ?? '');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [validFrom, setValidFrom] = useState(nowLocal);
  const [validTo, setValidTo] = useState(nowLocal);
  const [hazards, setHazards] = useState('');
  const [ppeRequired, setPpeRequired] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { workOrders } = useWorkOrders({ status: [...OPEN_WO_STATUSES] });
  const { users } = useCompanyUsers(companyId);
  const supervisors = useMemo(
    () => users.filter((u) => ['supervisor', 'plant_manager', 'admin'].includes(u.role)),
    [users],
  );

  const selectedWO = useMemo(
    () => workOrders.find((w) => w.id === workOrderId) ?? null,
    [workOrders, workOrderId],
  );

  // When a WO is chosen, seed the permit's title/location from it if blank.
  useEffect(() => {
    if (!selectedWO) return;
    setTitle((t) => t || (selectedWO.description ? `Permit for ${selectedWO.woNumber}` : t));
    setLocation((l) => l || selectedWO.machineName || selectedWO.machineLocation || '');
    setDescription((d) => d || selectedWO.description || '');
  }, [selectedWO]);

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
      const sup = supervisorId ? supervisors.find((s) => s.id === supervisorId) : undefined;
      await createWorkPermit({
        companyId: profile.companyId,
        siteId: profile.siteIds?.[0] || profile.companyId,
        category,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        machineId: selectedWO?.machineId ?? null,
        status: 'active',
        validFrom,
        validTo,
        hazards: hazards.trim(),
        precautions: categoryDef.precautions.filter((p) => checked[p]),
        ppeRequired: ppeRequired.trim(),
        workOrderId: selectedWO?.id ?? null,
        workOrderNumber: selectedWO?.woNumber ?? null,
        woType: selectedWO?.woType ?? null,
        woDescription: selectedWO?.description ?? null,
        woCreatedBy: selectedWO?.createdBy ?? null,
        woCreatedByName: selectedWO?.createdByName ?? null,
        supervisorId: sup?.id ?? null,
        supervisorName: sup?.fullName ?? null,
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
          {/* Linked work order */}
          <div>
            <label className={labelCls}>Work order (optional)</label>
            <select value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)} className={field} disabled={!!presetWorkOrderId}>
              <option value="">Not linked to a work order</option>
              {workOrders.map((w) => (
                <option key={w.id} value={w.id}>{w.woNumber} — {w.machineName ?? 'Machine'}</option>
              ))}
            </select>
            {selectedWO && (
              <div className="mt-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-xs text-[#8BA3BF]">
                <div><span className="text-[#F0F4F8]">Type:</span> {selectedWO.woType}</div>
                {selectedWO.description && <div className="mt-0.5"><span className="text-[#F0F4F8]">Description:</span> {selectedWO.description}</div>}
                {selectedWO.createdByName && <div className="mt-0.5"><span className="text-[#F0F4F8]">WO created by:</span> {selectedWO.createdByName}</div>}
              </div>
            )}
          </div>

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
              <input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={field} />
            </div>
            <div>
              <label className={labelCls}>Valid to (duration)</label>
              <input type="datetime-local" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={field} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Assign supervisor (optional)</label>
            <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={field}>
              <option value="">No supervisor — safety team owns sign-off</option>
              {supervisors.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.role})</option>)}
            </select>
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
