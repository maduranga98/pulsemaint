import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContractorJob } from '@/hooks/contractors/useContractorJob';
import WorkLogEntryForm from '@/components/contractors/jobs/WorkLogEntryForm';
import WorkLogTimeline from '@/components/contractors/jobs/WorkLogTimeline';

export function LogWorkPage() {
  const { t } = useTranslation();
  const { jobId } = useParams();
  const { job, loading } = useContractorJob(jobId);

  if (loading) return <div className="p-6 text-slate-500">{t('common.contractors.jobs.logWorkPage.loading')}</div>;
  if (!job) return <div className="p-6 text-slate-500">{t('common.contractors.jobs.logWorkPage.notFound')}</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{job.contractorName}</h1>
        <p className="mt-1 text-sm text-slate-500">{job.machineName} - {job.workOrderNumber}</p>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t('common.contractors.jobs.logWorkPage.onSiteFor', { minutes: job.onSiteDurationMinutes ?? 0 })}</div>
      <WorkLogTimeline steps={job.workSteps} />
      <WorkLogEntryForm />
      <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-slate-50 p-3">
        <button type="button" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">{t('common.contractors.jobs.logWorkPage.actions.logDeparture')}</button>
        <Link to={`/app/contractors/jobs/${job.id}/sign-off`} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{t('common.contractors.jobs.logWorkPage.actions.completeChecklist')}</Link>
      </div>
    </div>
  );
}

export default LogWorkPage;
