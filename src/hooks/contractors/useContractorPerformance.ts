import { useMemo } from 'react';
import { useContractors } from './useContractors';
import { useContractorJobs } from './useContractorJobs';

export function useContractorPerformance() {
  const contractorState = useContractors();
  const jobState = useContractorJobs();

  const summary = useMemo(() => {
    const active = contractorState.contractors.filter((contractor) => contractor.status === 'active');
    const avgRating = active.length
      ? active.reduce((sum, contractor) => sum + contractor.avgRating, 0) / active.length
      : 0;
    const slaComplianceRate = active.length
      ? active.reduce((sum, contractor) => sum + contractor.slaComplianceRate, 0) / active.length
      : 0;

    return {
      totalActiveContractors: active.length,
      totalJobsThisMonth: jobState.jobs.filter((job) => {
        const created = job.createdAt?.toDate();
        const now = new Date();
        return created && created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length,
      avgRating: Number(avgRating.toFixed(2)),
      slaComplianceRate: Number(slaComplianceRate.toFixed(2)),
      topPerformer: [...active].sort((a, b) => b.avgRating - a.avgRating)[0] ?? null,
      worstPerformer: [...active].sort((a, b) => b.repeatBreakdownRate - a.repeatBreakdownRate || a.slaComplianceRate - b.slaComplianceRate)[0] ?? null,
    };
  }, [contractorState.contractors, jobState.jobs]);

  return {
    contractors: contractorState.contractors,
    jobs: jobState.jobs,
    summary,
    loading: contractorState.loading || jobState.loading,
    error: contractorState.error ?? jobState.error,
  };
}
