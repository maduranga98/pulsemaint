import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
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
const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  plant_manager: 'Plant Manager',
  supervisor: 'Supervisor',
  technician: 'Technician',
  floor_operator: 'Operator',
};

export default function ReportSafetyCaseModal({ onClose, onCreated }: Props) {
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
    return { subjectId, subjectName: p ? `${p.fullName} (${ROLE_LABEL[p.role] ?? p.role})` : subjectId };
  }

  async function submit() {
    if (!profile?.companyId) return;
    if (!title.trim()) {
      toast.error('Give the case a short title.');
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
        message: `New safety case reported: ${title.trim()}`,
        oversightMessage: `reported a safety case: ${title.trim()}`,
        linkTo: '/app/safety/cases',
        ...actor,
      });
      if (reportTo) {
        void notifyUsers(profile.companyId, [reportTo.id], {
          type: 'alert',
          severity: severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
          message: `Safety case reported to you: ${title.trim()}`,
          oversightMessage: `reported a safety case to ${reportTo.fullName}: ${title.trim()}`,
          linkTo: '/app/safety/cases',
          ...actor,
        });
      }
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

  // Label + options for the conditional subject picker.
  const subjectPickerLabel =
    subjectType === 'work_order'
      ? 'Related work order (in progress)'
      : subjectType === 'contractor'
        ? 'Contractor'
        : subjectType === 'operator'
          ? 'Operator'
          : 'Technician';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-[Sora] text-lg font-bold text-[#F0F4F8]">Report Safety Case</h2>
          <button type="button" onClick={onClose} className="text-[#8BA3BF] hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {/* What the case is near / about */}
          <div>
            <label className={labelCls}>Incident is about</label>
            <select
              value={subjectType}
              onChange={(e) => {
                setSubjectType(e.target.value as SafetyCaseSubjectType);
                setSubjectId('');
              }}
              className={field}
            >
              {SAFETY_CASE_SUBJECT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {subjectType !== 'other' && (
            <div>
              <label className={labelCls}>{subjectPickerLabel}</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={field}>
                <option value="">Select…</option>
                {subjectType === 'work_order' &&
                  workOrders.map((w) => (
                    <option key={w.id} value={w.id}>{w.woNumber} — {w.machineName ?? 'Machine'}</option>
                  ))}
                {subjectType === 'contractor' &&
                  contractors.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                {(subjectType === 'operator' || subjectType === 'technician') &&
                  subjectPeople.map((p) => (
                    <option key={p.id} value={p.id}>{p.fullName} ({ROLE_LABEL[p.role] ?? p.role})</option>
                  ))}
              </select>
              {subjectType === 'work_order' && workOrders.length === 0 && (
                <p className="mt-1 text-xs text-[#8BA3BF]">No work orders are in progress right now.</p>
              )}
              {(subjectType === 'operator' || subjectType === 'technician') && subjectPeople.length === 0 && (
                <p className="mt-1 text-xs text-[#8BA3BF]">No {subjectPickerLabel.toLowerCase()}s found.</p>
              )}
            </div>
          )}

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

          {/* Points — auto-categorised from severity */}
          <div className="flex items-center justify-between rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2">
            <span className="text-xs font-medium text-[#8BA3BF]">Safety points (auto from severity)</span>
            <span className="font-[Sora] text-sm font-bold text-[#F59E0B]">{points} pts</span>
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
            <label className={labelCls}>Action that should be taken</label>
            <textarea value={actionToTake} onChange={(e) => setActionToTake(e.target.value)} rows={2} className={field} />
          </div>

          {/* Optional escalation */}
          <div>
            <label className={labelCls}>Report to (optional)</label>
            <select value={reportToId} onChange={(e) => setReportToId(e.target.value)} className={field}>
              <option value="">No one — keep with safety team</option>
              {reportToPeople.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({ROLE_LABEL[u.role] ?? u.role})</option>
              ))}
            </select>
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
