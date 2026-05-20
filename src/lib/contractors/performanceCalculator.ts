import type { ContractorJob } from './contractorTypes';

function average(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function minutesBetween(start?: { toMillis: () => number } | null, end?: { toMillis: () => number } | null): number | null {
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.toMillis() - start.toMillis()) / 60000));
}

export function calculateContractorMetrics(jobs: ContractorJob[]) {
  const signedJobs = jobs.filter((job) => job.status === 'signed_off' || job.signedOffAt);
  const breakdownJobs = jobs.filter((job) => job.workOrderType === 'breakdown_repair' || job.workOrderType === 'BREAKDOWN');
  const ratedJobs = jobs.filter((job) => job.rating);
  const invoicedJobs = jobs.filter((job) => job.invoiceStatus && job.invoiceStatus !== 'pending');
  const slaJobs = signedJobs.filter((job) => job.signedOffAt && job.slaDeadline);
  const breakdownDurations = breakdownJobs
    .map((job) => minutesBetween(job.arrivedAt, job.workCompletedAt ?? job.signedOffAt))
    .filter((value): value is number => value !== null);
  const responseTimes = jobs
    .map((job) => minutesBetween(job.invitationSentAt, job.arrivedAt))
    .filter((value): value is number => value !== null);
  const lastSigned = signedJobs
    .filter((job) => job.signedOffAt)
    .sort((a, b) => (b.signedOffAt?.toMillis() ?? 0) - (a.signedOffAt?.toMillis() ?? 0))[0];

  return {
    totalJobsCount: jobs.length,
    breakdownJobsCount: breakdownJobs.length,
    pmJobsCount: jobs.filter((job) => job.workOrderType === 'preventive_maintenance' || job.workOrderType === 'PREVENTIVE').length,
    installationJobsCount: jobs.filter((job) => job.workOrderType === 'installation' || job.workOrderType === 'INSTALLATION').length,
    avgRating: average(ratedJobs.map((job) => job.rating?.overallScore ?? 0)),
    ratingCount: ratedJobs.length,
    avgMttr: average(breakdownDurations),
    firstFixRate: jobs.length ? Number(((jobs.filter((job) => !job.followUpRequired).length / jobs.length) * 100).toFixed(2)) : 0,
    slaComplianceRate: slaJobs.length
      ? Number(((slaJobs.filter((job) => (job.signedOffAt?.toMillis() ?? 0) <= (job.slaDeadline?.toMillis() ?? 0)).length / slaJobs.length) * 100).toFixed(2))
      : 0,
    avgJobCost: average(jobs.map((job) => (job.systemLaborCost ?? 0) + (job.totalPartsFactoryCost ?? 0))),
    avgResponseTime: average(responseTimes),
    invoiceAccuracyRate: invoicedJobs.length
      ? Number(((invoicedJobs.filter((job) => !job.invoiceVarianceFlagged).length / invoicedJobs.length) * 100).toFixed(2))
      : 0,
    repeatBreakdownRate: breakdownJobs.length
      ? Number(((breakdownJobs.filter((job) => job.followUpRequired).length / breakdownJobs.length) * 100).toFixed(2))
      : 0,
    lastJobDate: lastSigned?.signedOffAt ?? null,
    lastJobId: lastSigned?.id ?? '',
  };
}
