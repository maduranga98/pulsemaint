import { useState } from 'react';
import { CircleDashed, PauseCircle, PlayCircle } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/firebase';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';

interface JobTimelineSectionProps {
  job: ContractorJob;
}

function fmt(ts?: { toDate: () => Date } | null): string {
  return ts ? ts.toDate().toLocaleString() : '';
}

/**
 * Captures the WO timing milestones a contractor's job history needs
 * (PMGR-021): start/complete of hands-on work, and wait-for-parts /
 * wait-for-permission windows, separate from actual working time.
 */
export function JobTimelineSection({ job }: JobTimelineSectionProps) {
  const { t } = useTranslation();
  const access = useContractorAccess();
  const [saving, setSaving] = useState(false);

  async function update(fields: Record<string, unknown>, message: string) {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'contractorJobs', job.id), { ...fields, updatedAt: serverTimestamp() });
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.contractors.jobs.timeline.toasts.updateFailed'));
    } finally {
      setSaving(false);
    }
  }

  const waitingForParts = Boolean(job.waitForPartsAt) && !job.waitForPartsResolvedAt;
  const waitingForPermission = Boolean(job.waitForPermissionAt) && !job.waitForPermissionResolvedAt;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">{t('common.contractors.jobs.timeline.title')}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <PlayCircle className="mb-2 h-4 w-4 text-blue-600" />
          {t('common.contractors.jobs.timeline.workStarted', { value: fmt(job.workStartedAt) })}
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <PlayCircle className="mb-2 h-4 w-4 text-emerald-600" />
          {t('common.contractors.jobs.timeline.workCompleted', { value: fmt(job.workCompletedAt) })}
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <PauseCircle className="mb-2 h-4 w-4 text-amber-600" />
          {t('common.contractors.jobs.timeline.waitingForParts', { start: fmt(job.waitForPartsAt), end: fmt(job.waitForPartsResolvedAt) })}
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <CircleDashed className="mb-2 h-4 w-4 text-amber-600" />
          {t('common.contractors.jobs.timeline.waitingForPermission', { start: fmt(job.waitForPermissionAt), end: fmt(job.waitForPermissionResolvedAt) })}
        </div>
      </div>

      {access.canLogContractorWork && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!job.workStartedAt && (
            <button
              type="button"
              disabled={saving}
              onClick={() => update({ workStartedAt: serverTimestamp() }, t('common.contractors.jobs.timeline.toasts.workStartLogged'))}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t('common.contractors.jobs.timeline.actions.startWork')}
            </button>
          )}
          {job.workStartedAt && !job.workCompletedAt && (
            <button
              type="button"
              disabled={saving}
              onClick={() => update({ workCompletedAt: serverTimestamp() }, t('common.contractors.jobs.timeline.toasts.workCompletionLogged'))}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t('common.contractors.jobs.timeline.actions.markWorkComplete')}
            </button>
          )}
          {!waitingForParts ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => update({ waitForPartsAt: serverTimestamp(), waitForPartsResolvedAt: null }, t('common.contractors.jobs.timeline.toasts.markedWaitingForParts'))}
              className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 disabled:opacity-60"
            >
              {t('common.contractors.jobs.timeline.actions.markWaitingForParts')}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => update({ waitForPartsResolvedAt: serverTimestamp() }, t('common.contractors.jobs.timeline.toasts.partsWaitResolved'))}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t('common.contractors.jobs.timeline.actions.resolvePartsWait')}
            </button>
          )}
          {!waitingForPermission ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => update({ waitForPermissionAt: serverTimestamp(), waitForPermissionResolvedAt: null }, t('common.contractors.jobs.timeline.toasts.markedWaitingForPermission'))}
              className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 disabled:opacity-60"
            >
              {t('common.contractors.jobs.timeline.actions.markWaitingForPermission')}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => update({ waitForPermissionResolvedAt: serverTimestamp() }, t('common.contractors.jobs.timeline.toasts.permissionWaitResolved'))}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t('common.contractors.jobs.timeline.actions.resolvePermissionWait')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default JobTimelineSection;
