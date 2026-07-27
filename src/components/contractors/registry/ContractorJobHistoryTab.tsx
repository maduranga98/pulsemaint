import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ContractorCompletedProject, ContractorJob } from '@/lib/contractors/contractorTypes';
import { formatLkr } from '@/lib/contractors/invoiceCalculator';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';
import type { ContractorAuditRatingRow } from '@/hooks/contractors/useContractorAuditRatings';
import ContractorJobStatusBadge from '@/components/contractors/jobs/ContractorJobStatusBadge';
import InvoiceVarianceBadge from '@/components/contractors/jobs/InvoiceVarianceBadge';

interface ContractorJobHistoryTabProps {
  jobs: ContractorJob[];
  previouslyCompletedProjects?: ContractorCompletedProject[];
  auditRatings?: ContractorAuditRatingRow[];
}

function fmtTs(ts?: { toDate: () => Date } | null): string {
  return ts ? ts.toDate().toLocaleDateString() : '';
}

function waitMinutes(start?: { toDate: () => Date } | null, end?: { toDate: () => Date } | null): number | null {
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.toDate().getTime() - start.toDate().getTime()) / 60000));
}

export function ContractorJobHistoryTab({ jobs, previouslyCompletedProjects = [], auditRatings = [] }: ContractorJobHistoryTabProps) {
  // Job detail pages carry active work-log/sign-off/invoice actions gated to
  // supervisor/plant_manager/admin — roles without that access (e.g.
  // hr_officer viewing job history for compliance) get the reference number
  // as plain text instead of a dead-end link.
  const { canReadRegistry } = useContractorAccess();
  const ratedJobs = jobs.filter((job) => job.rating);
  const avgRating = ratedJobs.reduce((sum, job) => sum + (job.rating?.overallScore ?? 0), 0) / Math.max(1, ratedJobs.length);
  const jobCost = (job: ContractorJob) => job.totalProjectCost ?? job.systemInvoiceAmount ?? 0;
  const totalCost = jobs.reduce((sum, job) => sum + jobCost(job), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Total jobs</p><p className="text-2xl font-bold">{jobs.length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Avg rating</p><p className="text-2xl font-bold">{avgRating.toFixed(1)}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Total cost</p><p className="text-2xl font-bold">{formatLkr(totalCost)}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">SLA jobs</p><p className="text-2xl font-bold">{jobs.filter((job) => job.signedOffAt && job.slaDeadline && job.signedOffAt.toMillis() <= job.slaDeadline.toMillis()).length}</p></div>
      </div>
      <div className="space-y-3">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {canReadRegistry ? (
                    <Link to={`/app/contractors/jobs/${job.id}`} className="font-semibold text-blue-700">{job.workOrderNumber}</Link>
                  ) : (
                    <span className="font-semibold text-slate-900">{job.workOrderNumber}</span>
                  )}
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
              <span>Rating: {job.rating ? `${job.rating.overallScore.toFixed(1)} ★` : '-'}</span>
              <span className="font-medium text-slate-800">Project cost: {formatLkr(jobCost(job))}</span>
              {typeof job.invoiceVariancePercent === 'number' && <InvoiceVarianceBadge percent={job.invoiceVariancePercent} />}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Started: {fmtTs(job.workStartedAt)}</span>
              <span>Completed: {fmtTs(job.workCompletedAt)}</span>
              <span>Signed off: {fmtTs(job.signedOffAt)}</span>
              {waitMinutes(job.waitForPartsAt, job.waitForPartsResolvedAt) !== null && (
                <span>Waited for parts: {waitMinutes(job.waitForPartsAt, job.waitForPartsResolvedAt)} min</span>
              )}
              {waitMinutes(job.waitForPermissionAt, job.waitForPermissionResolvedAt) !== null && (
                <span>Waited for permission: {waitMinutes(job.waitForPermissionAt, job.waitForPermissionResolvedAt)} min</span>
              )}
            </div>
          </article>
        ))}
        {!jobs.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No job history yet.</div>}
      </div>
      {auditRatings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Audit Ratings</h3>
          <p className="text-xs text-slate-500">Per-job star ratings and notes captured during Contractor Audits.</p>
          {auditRatings.map((r, index) => (
            <article key={`${r.sessionId}-${r.jobId}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{r.workOrderNumber || 'Unlinked job'}</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-4 w-4 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  ))}
                </div>
              </div>
              {r.notes && <p className="mt-2 text-sm text-slate-600">{r.notes}</p>}
              <p className="mt-2 text-xs text-slate-500">
                From audit by {r.auditorName || 'Unknown'} on {r.auditDate || (r.submittedAt ? r.submittedAt.toDate().toLocaleDateString() : '-')}
              </p>
            </article>
          ))}
        </div>
      )}
      {previouslyCompletedProjects.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Previously Completed Projects</h3>
          <p className="text-xs text-slate-500">Projects recorded before the contractor was onboarded into the system.</p>
          {previouslyCompletedProjects.map((project, index) => (
            <article key={`${project.name}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{project.name}</span>
                {project.contractType && <span className="rounded-full bg-slate-200 px-2 py-1 text-xs">{project.contractType}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                <span>Rating: {project.rating || '-'}</span>
                <span className="font-medium text-slate-800">Project cost: {project.cost || '-'}</span>
                {project.duration && <span>Duration: {project.duration}</span>}
              </div>
              {project.forbiddenActions && (
                <p className="mt-2 text-xs text-red-700">Forbidden actions: {project.forbiddenActions}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContractorJobHistoryTab;
