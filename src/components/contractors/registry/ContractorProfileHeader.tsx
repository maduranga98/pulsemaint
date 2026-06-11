import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreVertical, Star, X } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  const [rating, setRating] = useState(false);

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
            <>
              <button
                type="button"
                onClick={() => setRating(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
              >
                <Star className="h-4 w-4" />
                Rate
              </button>
              <Link to={`/app/contractors/${contractor.id}/edit`} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                Edit
              </Link>
            </>
          )}
          <button type="button" className="rounded-md border border-slate-200 p-2 text-slate-600" aria-label="More actions">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {rating && <RateContractorModal contractor={contractor} onClose={() => setRating(false)} />}
    </header>
  );
}

/**
 * PM-062 — Edit/Rate button to change a contractor's rating at any time.
 */
function RateContractorModal({ contractor, onClose }: { contractor: Contractor; onClose: () => void }) {
  const [value, setValue] = useState(Math.round(contractor.avgRating) || 0);
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (value < 1) {
      setError('Select a rating from 1 to 5 stars.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'contractors', contractor.id), {
        avgRating: value,
        ratingManuallySet: true,
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rating.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Rate {contractor.companyName}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="my-5 flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setValue(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${star} star`}
            >
              <Star className={`h-8 w-8 ${(hover || value) >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
            </button>
          ))}
        </div>
        {error && <p className="mb-3 text-center text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContractorProfileHeader;
