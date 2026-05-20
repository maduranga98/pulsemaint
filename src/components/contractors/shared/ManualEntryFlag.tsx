import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

interface ManualEntryFlagProps {
  contractorName: string;
}

export function ManualEntryFlag({ contractorName }: ManualEntryFlagProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        {contractorName} is not registered.
      </span>
      <Link to="/app/contractors/new" className="font-semibold text-amber-900 underline">
        Register Now
      </Link>
    </div>
  );
}

export default ManualEntryFlag;
