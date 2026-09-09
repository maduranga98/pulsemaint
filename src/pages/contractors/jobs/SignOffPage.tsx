import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContractorJob } from '@/hooks/contractors/useContractorJob';
import SignOffForm from '@/components/contractors/jobs/SignOffForm';

export function SignOffPage() {
  const { t } = useTranslation();
  const { jobId } = useParams();
  const { job, loading } = useContractorJob(jobId);

  if (loading) return <div className="p-6 text-slate-500">{t('common.contractors.jobs.signOffPage.loading')}</div>;
  if (!job) return <div className="p-6 text-slate-500">{t('common.contractors.jobs.signOffPage.notFound')}</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.jobs.signOffPage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{job.workOrderNumber} - {job.contractorName}</p>
      </div>
      <SignOffForm job={job} />
    </div>
  );
}

export default SignOffPage;
