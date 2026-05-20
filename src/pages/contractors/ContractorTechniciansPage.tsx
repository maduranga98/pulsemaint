import { Link, useParams } from 'react-router-dom';
import { useContractorTechnicians } from '@/hooks/contractors/useContractorTechnicians';
import TechnicianGrid from '@/components/contractors/technicians/TechnicianGrid';

export function ContractorTechniciansPage() {
  const { contractorId } = useParams();
  const { technicians, loading } = useContractorTechnicians(contractorId);

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Contractor Technicians</h1>
          <p className="mt-1 text-sm text-slate-500">{technicians.length} technicians registered.</p>
        </div>
        <Link to={`/app/contractors/${contractorId}/technicians/new`} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Add Technician</Link>
      </div>
      {loading ? <div className="text-slate-500">Loading technicians...</div> : <TechnicianGrid technicians={technicians} />}
    </div>
  );
}

export default ContractorTechniciansPage;
