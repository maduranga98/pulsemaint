import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useContractors } from '@/hooks/contractors/useContractors';
import { createSafetyCase } from '@/services/safety.service';
import { notifyRoles, notifyUsers } from '@/services/notifications.service';
import type { UserRole } from '@/types/auth';
import {
  SAFETY_CASE_SEVERITIES,
  SAFETY_CASE_SUBJECT_TYPES,
  SAFETY_CASE_TYPES,
  severityPoints,
  type SafetyCaseSeverity,
  type SafetyCaseSubjectType,
  type SafetyCaseType,
} from '@/types/safety';

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

const field = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] outline-none focus:border-[#1A56DB]';
const labelCls = 'block text-xs font-medium text-[#8BA3BF] mb-1';

// Roles a case can be escalated to, and how a person shows in that picker.
const REPORT_TO_ROLES = ['admin', 'plant_manager', 'supervisor'];
const ROLE_LABEL_FALLBACK: Record<string, string> = {
  admin: 'Admin',
  plant_manager: 'Plant Manager',
  supervisor: 'Supervisor',
  technician: 'Technician',
  floor_operator: 'Operator',
};

function roleLabel(role: string, t: TFunction): string {
  return t(`common.safetyCases.roleLabels.${role}`, { defaultValue: ROLE_LABEL_FALLBACK[role] ?? role });
}
function typeLabel(value: string, t: TFunction): string {
  const fallback = SAFETY_CASE_TYPES.find((x) => x.value === value)?.label ?? value;
  return t(`common.safetyCases.types.${value}`, { defaultValue: fallback });
}
function severityLabel(value: string, t: TFunction): string {
  const fallback = SAFETY_CASE_SEVERITIES.find((x) => x.value === value)?.label ?? value;
  return t(`common.safetyCases.severities.${value}`, { defaultValue: fallback });
}
function subjectLabel(value: string, t: TFunction): string {
  const fallback = SAFETY_CASE_SUBJECT_TYPES.find((x) => x.value === value)?.label ?? value;
  return t(`common.safetyCases.subjectTypes.${value}`, { defaultValue: fallback });
}

export default function ReportSafetyCaseModal({ onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const toast = useToast();

  const [type, setType] = useState<SafetyCaseType>('near_miss');
  const [severity, setSeverity] = useState<SafetyCaseSeverity>('medium');
  const [subjectType, setSubjectType] = useState<SafetyCaseSubjectType>('other');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [actionToTake, setActionToTake] = useState('');
  const [reportToId, setReportToId] = useState('');
  const [saving, setSaving] = useState(false);

  const { users } = useCompanyUsers(companyId);
  const { contractors } = useContractors();
  // Only in-progress work orders are eligible subjects.
  const { workOrders } = useWorkOrders({ status: ['IN_PROGRESS'] });

  const points = severityPoints(severity);

  // People eligible for the subject picker, filtered by the chosen role.
  const subjectPeople = useMemo(() => {
    if (subjectType === 'operator') return users.filter((u) => u.role === 'floor_operator');
    if (subjectType === 'technician') return users.filter((u) => u.role === 'technician');
    return [];
  }, [users, subjectType]);

  const reportToPeople = useMemo(
    () => users.filter((u) => REPORT_TO_ROLES.includes(u.role)),
    [users],
  );

  function resolveSubject(): { subjectId: string | null; subjectName: string | null } {
    if (subjectType === 'other' || !subjectId) return { subjectId: null, subjectName: null };
    if (subjectType === 'work_order') {
      const wo = workOrders.find((w) => w.id === subjectId);
      return { subjectId, subjectName: wo ? `${wo.woNumber} — ${wo.machineName ?? ''}`.trim() : subjectId };
    }
    if (subjectType === 'contractor') {
      const c = contractors.find((c) => c.id === subjectId);
      return { subjectId, subjectName: c?.companyName ?? subjectId };
    }
    const p = subjectPeople.find((u) => u.id === subjectId);
    return { subjectId, subjectName: p ? `${p.fullName} (${roleLabel(p.role, t)})` : subjectId };
  }

  async function submit() {
    if (!profile?.companyId) return;
    if (!title.trim()) {
      toast.error(t('common.safetyCases.createModal.errors.titleRequired'));
      return;
    }
    setSaving(true);
    try {
      const subject = resolveSubject();
      const reportTo = reportToId ? reportToPeople.find((u) => u.id === reportToId) : undefined;
      await createSafetyCase({
        companyId: profile.companyId,
        siteId: profile.siteIds?.[0] || profile.companyId,
        type,
        title: title.trim(),
        description: description.trim(),
        severity,
        points,
        status: 'open',
        location: location.trim(),
        machineId: null,
        machineName: null,
        subjectType,
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        correctiveAction: '',
        actionToTake: actionToTake.trim(),
        reportedToRole: reportTo?.role ?? null,
        reportedToUserId: reportTo?.id ?? null,
        reportedToName: reportTo?.fullName ?? null,
        actions: [],
        reportedBy: profile.id,
        reportedByName: profile.fullName ?? '',
        reportedByRole: profile.role ?? '',
      });

      const actor = {
        actorName: profile.fullName ?? '',
        actorRole: (profile.role ?? null) as UserRole | null,
        actorUserId: profile.id,
      };
      void notifyRoles(profile.companyId, ['safety_officer'], {
        type: 'alert',
        severity: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
        message: t('common.safetyCases.createModal.notifications.newCase', { title: title.trim() }),
        oversightMessage: t('common.safetyCases.createModal.notifications.newCaseOversight', { title: title.trim() }),
        linkTo: '/app/safety/cases',
        ...actor,
      });
      if (reportTo) {
        void notifyUsers(profile.companyId, [reportTo.id], {
          type: 'alert',
          severity: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
          message: t('common.safetyCases.createModal.notifications.reportedTo', { title: title.trim() }),
          oversightMessage: t('common.safetyCases.createModal.notifications.reportedToOversight', { name: reportTo.fullName, title: title.trim() }),
          linkTo: '/app/safety/cases',
          ...actor,
        });
      }
      toast.success(t('common.safetyCases.createModal.toasts.logged'));
      onCreated?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t('common.safetyCases.createModal.toasts.failed'));
    } finally {
      setSaving(false);
    }
  }

  // Label + options for the conditional subject picker.
  const subjectPickerLabel =
    subjectType === 'work_order'
      ? t('common.safetyCases.createModal.subject.workOrderLabel')
      : subjectType === 'contractor'
        ? t('common.safetyCases.subjectTypes.contractor')
        : subjectType === 'operator'
          ? t('common.safetyCases.subjectTypes.operator')
          : t('common.safetyCases.subjectTypes.technician');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className=" text-lg font-bold text-[#F0F4F8]">{t('common.safetyCases.createModal.title')}</h2>
          <button type="button" onClick={onClose} className="text-[#8BA3BF] hover:text-white" aria-label={t('common.safetyCases.createModal.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {/* What the case is near / about */}
          <div>
            <label className={labelCls}>{t('common.safetyCases.createModal.subject.label')}</label>
            <select
              value={subjectType}
              onChange={(e) => {
                setSubjectType(e.target.value as SafetyCaseSubjectType);
                setSubjectId('');
              }}
              className={field}
            >
              {SAFETY_CASE_SUBJECT_TYPES.map((s) => <option key={s.value} value={s.value}>{subjectLabel(s.value, t)}</option>)}
            </select>
          </div>

          {subjectType !== 'other' && (
            <div>
              <label className={labelCls}>{subjectPickerLabel}</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={field}>
                <option value="">{t('common.safetyCases.createModal.subject.select')}</option>
                {subjectType === 'work_order' &&
                  workOrders.map((w) => (
                    <option key={w.id} value={w.id}>
                      {t('common.safetyCases.createModal.subject.workOrderOption', {
                        number: w.woNumber,
                        machine: w.machineName ?? t('common.safetyCases.createModal.subject.machineFallback'),
                      })}
                    </option>
                  ))}
                {subjectType === 'contractor' &&
                  contractors.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                {(subjectType === 'operator' || subjectType === 'technician') &&
                  subjectPeople.map((p) => (
                    <option key={p.id} value={p.id}>{p.fullName} ({roleLabel(p.role, t)})</option>
                  ))}
              </select>
              {subjectType === 'work_order' && workOrders.length === 0 && (
                <p className="mt-1 text-xs text-[#8BA3BF]">{t('common.safetyCases.createModal.subject.noWorkOrders')}</p>
              )}
              {(subjectType === 'operator' || subjectType === 'technician') && subjectPeople.length === 0 && (
                <p className="mt-1 text-xs text-[#8BA3BF]">{t('common.safetyCases.createModal.subject.noPeople', { label: subjectPickerLabel.toLowerCase() })}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('common.safetyCases.createModal.fields.type')}</label>
              <select value={type} onChange={(e) => setType(e.target.value as SafetyCaseType)} className={field}>
                {SAFETY_CASE_TYPES.map((ty) => <option key={ty.value} value={ty.value}>{typeLabel(ty.value, t)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('common.safetyCases.createModal.fields.severity')}</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as SafetyCaseSeverity)} className={field}>
                {SAFETY_CASE_SEVERITIES.map((s) => <option key={s.value} value={s.value}>{severityLabel(s.value, t)}</option>)}
              </select>
            </div>
          </div>

          {/* Points — auto-categorised from severity */}
          <div className="flex items-center justify-between rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2">
            <span className="text-xs font-medium text-[#8BA3BF]">{t('common.safetyCases.createModal.fields.pointsLabel')}</span>
            <span className=" text-sm font-bold text-[#F59E0B]">{t('common.safetyCases.points', { points })}</span>
          </div>

          <div>
            <label className={labelCls}>{t('common.safetyCases.createModal.fields.title')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('common.safetyCases.createModal.fields.titlePlaceholder')} className={field} />
          </div>
          <div>
            <label className={labelCls}>{t('common.safetyCases.createModal.fields.location')}</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('common.safetyCases.createModal.fields.locationPlaceholder')} className={field} />
          </div>
          <div>
            <label className={labelCls}>{t('common.safetyCases.createModal.fields.whatHappened')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={field} />
          </div>
          <div>
            <label className={labelCls}>{t('common.safetyCases.createModal.fields.actionToTake')}</label>
            <textarea value={actionToTake} onChange={(e) => setActionToTake(e.target.value)} rows={2} className={field} />
          </div>

          {/* Optional escalation */}
          <div>
            <label className={labelCls}>{t('common.safetyCases.createModal.fields.reportTo')}</label>
            <select value={reportToId} onChange={(e) => setReportToId(e.target.value)} className={field}>
              <option value="">{t('common.safetyCases.createModal.fields.reportToNone')}</option>
              {reportToPeople.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({roleLabel(u.role, t)})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#1E3A5F] px-4 py-2 text-sm font-semibold text-[#8BA3BF] hover:text-white">{t('common.safetyCases.createModal.cancel')}</button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? t('common.safetyCases.createModal.saving') : t('common.safetyCases.createModal.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
