import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContractorJob } from '@/hooks/contractors/useContractorJob';
import RatingForm from '@/components/contractors/jobs/RatingForm';

export function RateContractorPage() {
  const { t } = useTranslation();
  const { jobId } = useParams();
  const { job, loading } = useContractorJob(jobId);

  if (loading) return <div className="p-6 text-slate-500">{t('common.contractors.jobs.ratePage.loading')}</div>;
  if (!job) return <div className="p-6 text-slate-500">{t('common.contractors.jobs.ratePage.notFound')}</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <RatingForm job={job} />
    </div>
  );
}

export default RateContractorPage;
