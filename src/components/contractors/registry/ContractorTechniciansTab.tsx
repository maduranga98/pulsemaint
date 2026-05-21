import { Link } from 'react-router-dom';
import type { ContractorTechnician } from '@/lib/contractors/contractorTypes';
import TechnicianGrid from '@/components/contractors/technicians/TechnicianGrid';

interface ContractorTechniciansTabProps {
  contractorId: string;
  technicians: ContractorTechnician[];
}

export function ContractorTechniciansTab({ contractorId, technicians }: ContractorTechniciansTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">{technicians.length} technicians registered</h2>
          <p className="text-sm text-slate-500">Individual contractor staff for gate identification and job history.</p>
        </div>
        <Link to={`/app/contractors/${contractorId}/technicians/new`} className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white">
          Add Technician
        </Link>
      </div>
      <TechnicianGrid technicians={technicians} />
    </div>
  );
}

export default ContractorTechniciansTab;
