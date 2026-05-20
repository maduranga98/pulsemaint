import { Star } from 'lucide-react';

interface ContractorRatingDisplayProps {
  rating: number;
  count?: number;
  compact?: boolean;
}

export function ContractorRatingDisplay({ rating, count, compact = false }: ContractorRatingDisplayProps) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-slate-700">
      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
      <span className="font-semibold text-slate-900">{rating ? rating.toFixed(1) : '0.0'}</span>
      {!compact && <span className="text-slate-500">({count ?? 0})</span>}
    </span>
  );
}

export default ContractorRatingDisplay;
