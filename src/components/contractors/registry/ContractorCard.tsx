import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import type { Contractor, ContractorDocument } from '@/lib/contractors/contractorTypes';
import { getContractorDocumentStatus } from '@/lib/contractors/documentExpiryHelper';
import { useContractorJobStats } from '@/hooks/contractors/useContractorJobStats';
import ContractorDocStatusDot from './ContractorDocStatusDot';
import ContractorRatingDisplay from './ContractorRatingDisplay';
import ContractorSpecializationTags from './ContractorSpecializationTags';
import ContractorStatusBadge from './ContractorStatusBadge';

interface ContractorCardProps {
  contractor: Contractor;
  documents?: ContractorDocument[];
}

export function ContractorCard({ contractor, documents = [] }: ContractorCardProps) {
  // Live figures, same as the desktop table — see useContractorJobStats.
  const { stats } = useContractorJobStats();
  const docStatus = contractor.blocksAssignment
    ? { status: 'expired' as const, label: 'Expired documents' }
    : getContractorDocumentStatus(documents);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-950">{contractor.companyName}</h3>
          {contractor.tradeName && <p className="text-xs text-slate-500">{contractor.tradeName}</p>}
        </div>
        <ContractorStatusBadge status={contractor.status} size="sm" />
      </div>
      <div className="mt-3">
        <ContractorSpecializationTags tags={contractor.specializationTags} limit={4} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <ContractorRatingDisplay
          rating={stats[contractor.id]?.ratingCount ? stats[contractor.id].avgRating : contractor.avgRating}
          count={stats[contractor.id]?.ratingCount ?? contractor.ratingCount}
          compact
        />
        <span className="text-slate-500">{stats[contractor.id]?.jobCount ?? contractor.totalJobsCount ?? 0} jobs</span>
      </div>
      <div className="mt-3">
        <ContractorDocStatusDot status={docStatus.status} label={docStatus.label} />
      </div>
      <a href={`tel:${contractor.emergencyContact || contractor.primaryPhone}`} className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-700">
        <Phone className="h-4 w-4" />
        {contractor.emergencyContact || contractor.primaryPhone}
      </a>
      <Link to={`/app/contractors/${contractor.id}`} className="mt-4 block rounded-md bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white">
        View Profile
      </Link>
    </article>
  );
}

export default ContractorCard;
