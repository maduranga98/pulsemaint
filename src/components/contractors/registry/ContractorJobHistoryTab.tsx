import { Link } from 'react-router-dom';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import { formatLkr } from '@/lib/contractors/invoiceCalculator';
import ContractorJobStatusBadge from '@/components/contractors/jobs/ContractorJobStatusBadge';
import InvoiceVarianceBadge from '@/components/contractors/jobs/InvoiceVarianceBadge';

interface ContractorJobHistoryTabProps {
  jobs: ContractorJob[];
}

export function ContractorJobHistoryTab({ jobs }: ContractorJobHistoryTabProps) {
  const avgRating = jobs.filter((job) => job.rating).reduce((sum, job) => sum + (job.rating?.overallScore ?? 0), 0) / Math.max(1, jobs.filter((job) => job.rating).length);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Total jobs</p><p className="text-2xl font-bold">{jobs.length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Avg rating</p><p className="text-2xl font-bold">{avgRating.toFixed(1)}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">SLA jobs</p><p className="text-2xl font-bold">{jobs.filter((job) => job.signedOffAt && job.slaDeadline && job.signedOffAt.toMillis() <= job.slaDeadline.toMillis()).length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Invoice flags</p><p className="text-2xl font-bold">{jobs.filter((job) => job.invoiceVarianceFlagged).length}</p></div>
      </div>
      <div className="space-y-3">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/app/contractors/jobs/${job.id}`} className="font-semibold text-blue-700">{job.workOrderNumber}</Link>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{job.workOrderType}</span>
                  <span className="rounded-full bg-red-50 px-2 py-1 text-xs capitalize text-red-700">{job.priority}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{job.machineName} - {job.machineLocation}</p>
                <p className="text-xs text-slate-500">{job.technicianNames.join(', ') || 'Technicians not logged'}</p>
              </div>
              <ContractorJobStatusBadge status={job.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
              <span>On-site: {job.onSiteDurationMinutes ?? 0} min</span>
              <span>Rating: {job.rating?.overallScore.toFixed(1) ?? '-'}</span>
              <span>Invoice: {formatLkr(job.contractorInvoiceAmount)} | System: {formatLkr(job.systemInvoiceAmount)}</span>
              {typeof job.invoiceVariancePercent === 'number' && <InvoiceVarianceBadge percent={job.invoiceVariancePercent} />}
            </div>
          </article>
        ))}
        {!jobs.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No job history yet.</div>}
      </div>
    </div>
  );
}

export default ContractorJobHistoryTab;
