import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import app from '@/lib/firebase';

export type ContractorReportType = 'performance' | 'invoice' | 'job_history' | 'compliance';

export interface ContractorReportFilters {
  contractorId?: string;
  machineId?: string;
  jobType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ContractorReportResult {
  storageUrl: string;
  reportType: ContractorReportType;
}

export async function generateContractorReport(params: {
  reportType: ContractorReportType;
  companyId: string;
  filters: ContractorReportFilters;
}): Promise<ContractorReportResult> {
  const callable = httpsCallable<typeof params, ContractorReportResult>(getFunctions(app), 'generateContractorReport');
  const result = await callable(params);
  return result.data;
}
