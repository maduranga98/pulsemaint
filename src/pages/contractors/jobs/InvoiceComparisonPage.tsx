import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContractor } from '@/hooks/contractors/useContractor';
import { useContractorJob } from '@/hooks/contractors/useContractorJob';
import InvoiceComparisonCard from '@/components/contractors/jobs/InvoiceComparisonCard';
import InvoiceUploadSection from '@/components/contractors/jobs/InvoiceUploadSection';

export function InvoiceComparisonPage() {
  const { t } = useTranslation();
  const { jobId } = useParams();
  const { job, loading } = useContractorJob(jobId);
  const { contractor } = useContractor(job?.contractorId);

  if (loading) return <div className="p-6 text-slate-500">{t('common.contractors.jobs.invoiceComparisonPage.loading')}</div>;
  if (!job) return <div className="p-6 text-slate-500">{t('common.contractors.jobs.invoiceComparisonPage.notFound')}</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.jobs.invoiceComparisonPage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{job.workOrderNumber} - {job.contractorName}</p>
      </div>
      {!job.contractorInvoiceUrl && <InvoiceUploadSection />}
      <InvoiceComparisonCard job={job} contractor={contractor} />
    </div>
  );
}

export default InvoiceComparisonPage;
