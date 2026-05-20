import { Link } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';
import type { Contractor } from '@/lib/contractors/contractorTypes';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';
import ContractorRatingDisplay from './ContractorRatingDisplay';
import ContractorSpecializationTags from './ContractorSpecializationTags';
import ContractorStatusBadge from './ContractorStatusBadge';

interface ContractorProfileHeaderProps {
  contractor: Contractor;
}

export function ContractorProfileHeader({ contractor }: ContractorProfileHeaderProps) {
  const access = useContractorAccess();

  return (
    <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-950">{contractor.companyName}</h1>
          {contractor.tradeName && <p className="mt-1 text-sm text-slate-500">{contractor.tradeName}</p>}
          <p className="mt-2 font-mono text-xs text-slate-500">{contractor.registrationNumber}</p>
          <div className="mt-3">
            <ContractorSpecializationTags tags={contractor.specializationTags} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <ContractorRatingDisplay rating={contractor.avgRating} count={contractor.ratingCount} />
            <span>{contractor.totalJobsCount} jobs</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ContractorStatusBadge status={contractor.status} size="lg" />
          {access.canManageContractors && (
            <Link to={`/app/contractors/${contractor.id}/edit`} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Edit
            </Link>
          )}
          <button type="button" className="rounded-md border border-slate-200 p-2 text-slate-600" aria-label="More actions">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default ContractorProfileHeader;
