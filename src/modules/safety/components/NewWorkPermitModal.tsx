import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useWorkPermitCategories } from '@/hooks/useWorkPermitCategories';
import { createWorkPermit } from '@/services/safety.service';
import { notifyRoles, notifyUsers } from '@/services/notifications.service';
import type { UserRole } from '@/types/auth';
import type { WorkPermitCategory } from '@/types/safety';

const ADD_NEW_CATEGORY = '__add_new__';

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
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const toast = useToast();
  // Local 'YYYY-MM-DDTHH:mm' for <input type="datetime-local">, defaulting to now.
  const nowLocal = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  })();

  const { categories, addCategory } = useWorkPermitCategories(companyId);
  const [category, setCategory] = useState<WorkPermitCategory>('hot_work');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
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
    () => categories.find((c) => c.value === category) ?? { value: category, label: category, precautions: [] },
    [categories, category],
  );

  async function handleAddCategory() {
    const value = await addCategory(newCategoryLabel);
    if (value) {
      setCategory(value);
      setChecked({});
    }
    setNewCategoryLabel('');
    setAddingCategory(false);
  }

  async function submit() {
    if (!profile?.companyId) return;
    if (!title.trim()) {
      toast.error(t('common.workPermits.createModal.errors.titleRequired'));
      return;
    }
    if (validTo < validFrom) {
      toast.error(t('common.workPermits.createModal.errors.validToBeforeFrom'));
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

      const actor = {
        actorName: profile.fullName ?? '',
        actorRole: (profile.role ?? null) as UserRole | null,
        actorUserId: profile.id,
      };
      void notifyRoles(profile.companyId, ['safety_officer'], {
        type: 'alert',
        severity: 'medium',
        message: `New work permit issued: ${title.trim()}`,
        oversightMessage: `issued work permit "${title.trim()}"`,
        linkTo: '/app/safety/permits',
        ...actor,
      });
      if (sup) {
        void notifyUsers(profile.companyId, [sup.id], {
          type: 'alert',
          severity: 'medium',
          message: `You're the responsible supervisor for a new work permit: ${title.trim()}`,
          oversightMessage: `issued work permit "${title.trim()}" naming ${sup.fullName} as supervisor`,
          linkTo: '/app/safety/permits',
          ...actor,
        });
      }
      toast.success(t('common.workPermits.createModal.toasts.issued'));
      onCreated?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t('common.workPermits.createModal.toasts.failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className=" text-lg font-bold text-[#F0F4F8]">{t('common.workPermits.createModal.title')}</h2>
          <button type="button" onClick={onClose} className="text-[#8BA3BF] hover:text-white" aria-label={t('common.workPermits.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {/* Linked work order */}
          <div>
            <label className={labelCls}>{t('common.workPermits.createModal.workOrder.label')}</label>
            <select value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)} className={field} disabled={!!presetWorkOrderId}>
              <option value="">{t('common.workPermits.createModal.workOrder.none')}</option>
              {workOrders.map((w) => (
                <option key={w.id} value={w.id}>
                  {t('common.workPermits.createModal.workOrder.option', { number: w.woNumber, machine: w.machineName ?? t('common.workPermits.createModal.workOrder.machineFallback') })}
                </option>
              ))}
            </select>
            {selectedWO && (
              <div className="mt-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-xs text-[#8BA3BF]">
                <div><span className="text-[#F0F4F8]">{t('common.workPermits.createModal.workOrder.type')}</span> {selectedWO.woType}</div>
                {selectedWO.description && <div className="mt-0.5"><span className="text-[#F0F4F8]">{t('common.workPermits.createModal.workOrder.description')}</span> {selectedWO.description}</div>}
                {selectedWO.createdByName && <div className="mt-0.5"><span className="text-[#F0F4F8]">{t('common.workPermits.createModal.workOrder.createdBy')}</span> {selectedWO.createdByName}</div>}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>{t('common.workPermits.createModal.category.label')}</label>
            {addingCategory ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  placeholder={t('common.workPermits.createModal.category.newCategoryPlaceholder')}
                  className={field}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddCategory(); } }}
                />
                <button type="button" onClick={() => void handleAddCategory()} className="shrink-0 rounded-lg bg-[#1A56DB] px-3 py-2 text-sm font-semibold text-white">
                  {t('common.workPermits.createModal.category.add')}
                </button>
                <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryLabel(''); }} className="shrink-0 rounded-lg border border-[#1E3A5F] px-3 py-2 text-sm text-[#8BA3BF] hover:text-white">
                  {t('common.workPermits.cancel')}
                </button>
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => {
                  if (e.target.value === ADD_NEW_CATEGORY) { setAddingCategory(true); return; }
                  setCategory(e.target.value as WorkPermitCategory);
                  setChecked({});
                }}
                className={field}
              >
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                <option value={ADD_NEW_CATEGORY}>{t('common.workPermits.createModal.category.addNew')}</option>
              </select>
            )}
          </div>
          <div>
            <label className={labelCls}>{t('common.workPermits.createModal.fields.title')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('common.workPermits.createModal.fields.titlePlaceholder')} className={field} />
          </div>
          <div>
            <label className={labelCls}>{t('common.workPermits.createModal.fields.location')}</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('common.workPermits.createModal.fields.locationPlaceholder')} className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('common.workPermits.createModal.fields.validFrom')}</label>
              <input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={field} />
            </div>
            <div>
              <label className={labelCls}>{t('common.workPermits.createModal.fields.validTo')}</label>
              <input type="datetime-local" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={field} />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('common.workPermits.createModal.fields.supervisor')}</label>
            <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={field}>
              <option value="">{t('common.workPermits.createModal.fields.noSupervisor')}</option>
              {supervisors.map((s) => <option key={s.id} value={s.id}>{s.fullName} ({s.role})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('common.workPermits.createModal.fields.description')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={field} />
          </div>
          <div>
            <label className={labelCls}>{t('common.workPermits.createModal.fields.hazards')}</label>
            <textarea value={hazards} onChange={(e) => setHazards(e.target.value)} rows={2} className={field} />
          </div>

          {/* Category-specific precautions */}
          <div>
            <p className={labelCls}>{t('common.workPermits.createModal.fields.precautions')}</p>
            <div className="space-y-1.5 rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3">
              {categoryDef.precautions.length === 0 && (
                <p className="text-xs text-[#8BA3BF]">{t('common.workPermits.createModal.fields.noPrecautions')}</p>
              )}
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
            <label className={labelCls}>{t('common.workPermits.createModal.fields.ppe')}</label>
            <input value={ppeRequired} onChange={(e) => setPpeRequired(e.target.value)} placeholder={t('common.workPermits.createModal.fields.ppePlaceholder')} className={field} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#1E3A5F] px-4 py-2 text-sm font-semibold text-[#8BA3BF] hover:text-white">{t('common.workPermits.cancel')}</button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? t('common.workPermits.createModal.saving') : t('common.workPermits.createModal.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
