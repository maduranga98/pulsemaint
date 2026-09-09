import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ContractorCompletedProject, ContractorJob } from '@/lib/contractors/contractorTypes';
import { formatLkr } from '@/lib/contractors/invoiceCalculator';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';
import type { ContractorAuditRatingRow } from '@/hooks/contractors/useContractorAuditRatings';
import type { WorkOrder } from '@/types/workOrder';
import ContractorJobStatusBadge from '@/components/contractors/jobs/ContractorJobStatusBadge';
import InvoiceVarianceBadge from '@/components/contractors/jobs/InvoiceVarianceBadge';

interface ContractorJobHistoryTabProps {
  jobs: ContractorJob[];
  /** Contractor-type work orders for this contractor — see
   *  useContractorWorkOrders for why they are a separate source. */
  workOrders?: WorkOrder[];
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

export function ContractorJobHistoryTab({
  jobs,
  workOrders = [],
  previouslyCompletedProjects = [],
  auditRatings = [],
}: ContractorJobHistoryTabProps) {
  const { t } = useTranslation();
  // Job detail pages carry active work-log/sign-off/invoice actions gated to
  // supervisor/plant_manager/admin — roles without that access (e.g.
  // hr_officer viewing job history for compliance) get the reference number
  // as plain text instead of a dead-end link.
  const { canReadRegistry } = useContractorAccess();
  const ratedJobs = jobs.filter((job) => job.rating);
  // Total cost = used-parts cost + project cost, as captured at sign-off.
  // Older jobs only stored the combined figure, so fall back to it and treat
  // the whole amount as project cost when the breakdown wasn't recorded.
  const partsCost = (job: ContractorJob) => job.totalPartsCost ?? 0;
  const jobCost = (job: ContractorJob) => job.totalProjectCost ?? job.systemInvoiceAmount ?? 0;
  const projectCost = (job: ContractorJob) => job.projectCost ?? Math.max(0, jobCost(job) - partsCost(job));
  const totalCost =
    jobs.reduce((sum, job) => sum + jobCost(job), 0) +
    workOrders.reduce((sum, wo) => sum + (wo.totalProjectCost ?? 0), 0);
  const ratedWorkOrders = workOrders.filter((wo) => wo.contractorRating);
  const allRated = ratedJobs.length + ratedWorkOrders.length;
  const combinedAvgRating =
    (ratedJobs.reduce((sum, job) => sum + (job.rating?.overallScore ?? 0), 0) +
      ratedWorkOrders.reduce((sum, wo) => sum + (wo.contractorRating?.overallScore ?? 0), 0)) /
    Math.max(1, allRated);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.stats.totalJobs')}</p><p className="text-2xl font-bold">{jobs.length + workOrders.length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.stats.avgRating')}</p><p className="text-2xl font-bold">{combinedAvgRating.toFixed(1)}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.stats.totalCost')}</p><p className="text-2xl font-bold">{formatLkr(totalCost)}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.stats.slaJobs')}</p><p className="text-2xl font-bold">{jobs.filter((job) => job.signedOffAt && job.slaDeadline && job.signedOffAt.toMillis() <= job.slaDeadline.toMillis()).length}</p></div>
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
                <p className="text-xs text-slate-500">{job.technicianNames.join(', ') || t('common.contractors.registry.jobHistoryTab.techniciansNotLogged')}</p>
              </div>
              <ContractorJobStatusBadge status={job.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
              <span>{t('common.contractors.registry.jobHistoryTab.onSite', { minutes: job.onSiteDurationMinutes ?? 0 })}</span>
              {typeof job.invoiceVariancePercent === 'number' && <InvoiceVarianceBadge percent={job.invoiceVariancePercent} />}
            </div>

            {/* Cost breakdown captured at sign-off: used parts + project cost. */}
            <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.usedPartsCost')}</p>
                <p className="font-medium text-slate-800">{formatLkr(partsCost(job))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.projectCost')}</p>
                <p className="font-medium text-slate-800">{formatLkr(projectCost(job))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.totalCost')}</p>
                <p className="font-bold text-slate-950">{formatLkr(jobCost(job))}</p>
              </div>
            </div>

            {/* Rating given for the job at sign-off. */}
            {job.rating ? (
              <div className="mt-3 rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {t('common.contractors.registry.jobHistoryTab.jobRating', { score: job.rating.overallScore.toFixed(1) })}
                  </p>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-4 w-4 ${n <= Math.round(job.rating!.overallScore) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>{t('common.contractors.registry.jobHistoryTab.ratingBreakdown.speed', { score: job.rating.speedScore })}</span>
                  <span>{t('common.contractors.registry.jobHistoryTab.ratingBreakdown.quality', { score: job.rating.qualityScore })}</span>
                  <span>{t('common.contractors.registry.jobHistoryTab.ratingBreakdown.professionalism', { score: job.rating.professionalismScore })}</span>
                  <span>{t('common.contractors.registry.jobHistoryTab.ratingBreakdown.communication', { score: job.rating.communicationScore })}</span>
                </div>
                {job.rating.notes && <p className="mt-2 text-sm text-slate-600">{job.rating.notes}</p>}
                <p className="mt-2 text-xs text-slate-500">
                  {t('common.contractors.registry.jobHistoryTab.ratedBy', { name: job.rating.ratedByName || t('common.contractors.registry.jobHistoryTab.unknown') })}
                  {job.rating.ratedAt ? t('common.contractors.registry.jobHistoryTab.ratedOn', { date: fmtTs(job.rating.ratedAt) }) : ''}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.notRatedYet')}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{t('common.contractors.registry.jobHistoryTab.started', { date: fmtTs(job.workStartedAt) })}</span>
              <span>{t('common.contractors.registry.jobHistoryTab.completed', { date: fmtTs(job.workCompletedAt) })}</span>
              <span>{t('common.contractors.registry.jobHistoryTab.signedOff', { date: fmtTs(job.signedOffAt) })}</span>
              {waitMinutes(job.waitForPartsAt, job.waitForPartsResolvedAt) !== null && (
                <span>{t('common.contractors.registry.jobHistoryTab.waitedForParts', { minutes: waitMinutes(job.waitForPartsAt, job.waitForPartsResolvedAt) })}</span>
              )}
              {waitMinutes(job.waitForPermissionAt, job.waitForPermissionResolvedAt) !== null && (
                <span>{t('common.contractors.registry.jobHistoryTab.waitedForPermission', { minutes: waitMinutes(job.waitForPermissionAt, job.waitForPermissionResolvedAt) })}</span>
              )}
            </div>
          </article>
        ))}
        {workOrders.map((wo) => {
          const partsCost = wo.totalPartsCost ?? 0;
          const total = wo.totalProjectCost ?? 0;
          const project = wo.projectCost ?? Math.max(0, total - partsCost);
          const rating = wo.contractorRating;
          return (
            <article key={wo.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{wo.woNumber}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{t('common.contractors.registry.jobHistoryTab.contractorWo')}</span>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-xs capitalize text-red-700">{wo.priority}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{wo.machineName} - {wo.machineLocation}</p>
                  <p className="text-xs text-slate-500">
                    {wo.contractorTechnicianNames?.join(', ') || t('common.contractors.registry.jobHistoryTab.techniciansNotLogged')}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{wo.status}</span>
              </div>

              <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.usedPartsCost')}</p>
                  <p className="font-medium text-slate-800">{formatLkr(partsCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.projectCost')}</p>
                  <p className="font-medium text-slate-800">{formatLkr(project)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.totalCost')}</p>
                  <p className="font-bold text-slate-950">{formatLkr(total)}</p>
                </div>
              </div>

              {rating ? (
                <div className="mt-3 rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {t('common.contractors.registry.jobHistoryTab.jobRating', { score: rating.overallScore.toFixed(1) })}
                    </p>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`h-4 w-4 ${n <= Math.round(rating.overallScore) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>{t('common.contractors.registry.jobHistoryTab.ratingBreakdown.speed', { score: rating.speedScore })}</span>
                    <span>{t('common.contractors.registry.jobHistoryTab.ratingBreakdown.quality', { score: rating.qualityScore })}</span>
                    <span>{t('common.contractors.registry.jobHistoryTab.ratingBreakdown.professionalism', { score: rating.professionalismScore })}</span>
                    <span>{t('common.contractors.registry.jobHistoryTab.ratingBreakdown.communication', { score: rating.communicationScore })}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {t('common.contractors.registry.jobHistoryTab.ratedBy', { name: rating.ratedByName || t('common.contractors.registry.jobHistoryTab.unknown') })}
                    {rating.ratedAt ? t('common.contractors.registry.jobHistoryTab.ratedOn', { date: fmtTs(rating.ratedAt) }) : ''}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.notRatedYet')}</p>
              )}

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{t('common.contractors.registry.jobHistoryTab.completed', { date: fmtTs(wo.actualEndTime) })}</span>
                <span>{t('common.contractors.registry.jobHistoryTab.signedOff', { date: fmtTs(wo.supervisorSignOffAt) })}</span>
              </div>
            </article>
          );
        })}
        {!jobs.length && !workOrders.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">{t('common.contractors.registry.jobHistoryTab.empty')}</div>}
      </div>
      {auditRatings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">{t('common.contractors.registry.jobHistoryTab.auditRatings.title')}</h3>
          <p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.auditRatings.subtitle')}</p>
          {auditRatings.map((r, index) => (
            <article key={`${r.sessionId}-${r.jobId}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{r.workOrderNumber || t('common.contractors.registry.jobHistoryTab.auditRatings.unlinkedJob')}</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-4 w-4 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  ))}
                </div>
              </div>
              {r.notes && <p className="mt-2 text-sm text-slate-600">{r.notes}</p>}
              <p className="mt-2 text-xs text-slate-500">
                {t('common.contractors.registry.jobHistoryTab.auditRatings.fromAudit', { name: r.auditorName || t('common.contractors.registry.jobHistoryTab.unknown'), date: r.auditDate || (r.submittedAt ? r.submittedAt.toDate().toLocaleDateString() : '-') })}
              </p>
            </article>
          ))}
        </div>
      )}
      {previouslyCompletedProjects.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">{t('common.contractors.registry.jobHistoryTab.completedProjects.title')}</h3>
          <p className="text-xs text-slate-500">{t('common.contractors.registry.jobHistoryTab.completedProjects.subtitle')}</p>
          {previouslyCompletedProjects.map((project, index) => (
            <article key={`${project.name}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{project.name}</span>
                {project.contractType && <span className="rounded-full bg-slate-200 px-2 py-1 text-xs">{project.contractType}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                <span>{t('common.contractors.registry.jobHistoryTab.completedProjects.rating', { rating: project.rating || '-' })}</span>
                <span className="font-medium text-slate-800">{t('common.contractors.registry.jobHistoryTab.completedProjects.projectCost', { cost: project.cost || '-' })}</span>
                {project.duration && <span>{t('common.contractors.registry.jobHistoryTab.completedProjects.duration', { duration: project.duration })}</span>}
              </div>
              {project.forbiddenActions && (
                <p className="mt-2 text-xs text-red-700">{t('common.contractors.registry.jobHistoryTab.completedProjects.forbiddenActions', { actions: project.forbiddenActions })}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContractorJobHistoryTab;
