import { useParams } from 'react-router-dom';
import { useContractorJobs } from '@/hooks/contractors/useContractorJobs';
import { useContractorWorkOrders } from '@/hooks/contractors/useContractorWorkOrders';
import ContractorJobHistoryTab from '@/components/contractors/registry/ContractorJobHistoryTab';

export function ContractorHistoryPage() {
  const { contractorId } = useParams();
  const { jobs, loading } = useContractorJobs({ contractorId });
  const { workOrders } = useContractorWorkOrders(contractorId);

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <h1 className="text-2xl font-bold text-slate-950">Contractor Job History</h1>
      {loading ? <div className="text-slate-500">Loading history...</div> : <ContractorJobHistoryTab jobs={jobs} workOrders={workOrders} />}
    </div>
  );
}

export default ContractorHistoryPage;
