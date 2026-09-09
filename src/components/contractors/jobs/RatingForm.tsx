import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import { syncContractorMetrics } from '@/lib/contractors/contractorMetricsSync';
import { notifyRoles } from '@/services/notifications.service';
import RatingQuickTags from './RatingQuickTags';
import RatingStarSelector from './RatingStarSelector';
import FollowUpFlagToggle from './FollowUpFlagToggle';

interface RatingFormProps {
  job: ContractorJob;
}

export function RatingForm({ job }: RatingFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userProfile = useAuthStore((state) => state.userProfile);
  const [speed, setSpeed] = useState(job.rating?.speedScore ?? 0);
  const [quality, setQuality] = useState(job.rating?.qualityScore ?? 0);
  const [professionalism, setProfessionalism] = useState(job.rating?.professionalismScore ?? 0);
  const [communication, setCommunication] = useState(job.rating?.communicationScore ?? 0);
  const [notes, setNotes] = useState(job.rating?.notes ?? '');
  const [followUp, setFollowUp] = useState(Boolean(job.followUpRequired));
  const [saving, setSaving] = useState(false);
  const overall = useMemo(() => {
    const scores = [speed, quality, professionalism, communication];
    return scores.every(Boolean) ? scores.reduce((sum, score) => sum + score, 0) / 4 : 0;
  }, [communication, professionalism, quality, speed]);
  const dimensions: Array<{
    label: string;
    value: number;
    setter: Dispatch<SetStateAction<number>>;
    helper: string;
  }> = [
    { label: t('common.contractors.jobs.ratingForm.dimensions.speed.label'), value: speed, setter: setSpeed, helper: t('common.contractors.jobs.ratingForm.dimensions.speed.helper') },
    { label: t('common.contractors.jobs.ratingForm.dimensions.quality.label'), value: quality, setter: setQuality, helper: t('common.contractors.jobs.ratingForm.dimensions.quality.helper') },
    { label: t('common.contractors.jobs.ratingForm.dimensions.professionalism.label'), value: professionalism, setter: setProfessionalism, helper: t('common.contractors.jobs.ratingForm.dimensions.professionalism.helper') },
    { label: t('common.contractors.jobs.ratingForm.dimensions.communication.label'), value: communication, setter: setCommunication, helper: t('common.contractors.jobs.ratingForm.dimensions.communication.helper') },
  ];

  async function handleSubmit() {
    if (!overall) {
      toast.error(t('common.contractors.jobs.ratingForm.toasts.incomplete'));
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'contractorJobs', job.id), {
        rating: {
          speedScore: speed,
          qualityScore: quality,
          professionalismScore: professionalism,
          communicationScore: communication,
          overallScore: Number(overall.toFixed(2)),
          notes: notes.trim() || null,
          ratedBy: userProfile?.id ?? null,
          ratedByName: userProfile?.fullName ?? null,
          ratedAt: serverTimestamp(),
        },
        followUpRequired: followUp,
        updatedAt: serverTimestamp(),
      });

      if (job.contractorId) {
        try {
          await syncContractorMetrics(job.contractorId, job.companyId);
        } catch (syncErr) {
          console.error('Failed to sync contractor metrics after rating', syncErr);
        }
      }

      // Oversight roles are copied on every notification (see
      // notifications.service).
      void notifyRoles(job.companyId, ['supervisor'], {
        type: 'work_order',
        message: `${userProfile?.fullName ?? 'Someone'} rated ${job.contractorName} ${overall.toFixed(1)}/5 on job ${job.workOrderNumber}`,
        oversightMessage: `rated ${job.contractorName} ${overall.toFixed(1)}/5 on job ${job.workOrderNumber}`,
        actorName: userProfile?.fullName ?? '',
        actorRole: userProfile?.role,
        actorUserId: userProfile?.id ?? null,
        linkTo: `/app/contractors/jobs/${job.id}`,
      });

      toast.success(t('common.contractors.jobs.ratingForm.toasts.success'));
      navigate(`/app/contractors/jobs/${job.id}`);
    } catch (err) {
      console.error('Submit rating failed', err);
      toast.error(err instanceof Error ? err.message : t('common.contractors.jobs.ratingForm.toasts.failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={(event) => event.preventDefault()}>
      <h2 className="text-lg font-semibold text-slate-950">{t('common.contractors.jobs.ratingForm.title', { contractorName: job.contractorName })}</h2>
      {dimensions.map(({ label, value, setter, helper }) => (
        <div key={label} className="rounded-lg border border-slate-200 p-3">
          <p className="font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{helper}</p>
          <div className="mt-2"><RatingStarSelector value={value} onChange={setter} /></div>
        </div>
      ))}
      <div className="rounded-lg bg-slate-50 p-4 text-center">
        <p className="text-sm text-slate-500">{t('common.contractors.jobs.ratingForm.overallScore')}</p>
        <p className="text-3xl font-bold text-slate-950">{overall ? overall.toFixed(1) : '-'}</p>
      </div>
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('common.contractors.jobs.ratingForm.notesPlaceholder')} className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
      <RatingQuickTags onSelect={(tag) => setNotes((value) => (value ? `${value}, ${tag}` : tag))} />
      <FollowUpFlagToggle enabled={followUp} onChange={setFollowUp} />
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={saving}
        className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {saving ? t('common.contractors.jobs.ratingForm.saving') : t('common.contractors.jobs.ratingForm.submit')}
      </button>
    </form>
  );
}

export default RatingForm;
