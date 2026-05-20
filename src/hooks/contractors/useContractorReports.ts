import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  generateContractorReport,
  type ContractorReportFilters,
  type ContractorReportResult,
  type ContractorReportType,
} from '@/lib/contractors/reportGenerator';

export function useContractorReports() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(reportType: ContractorReportType, filters: ContractorReportFilters): Promise<ContractorReportResult | null> {
    if (!companyId) return null;
    setLoading(true);
    setError(null);
    try {
      return await generateContractorReport({ reportType, companyId, filters });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate contractor report';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { generate, loading, error };
}
