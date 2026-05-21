import { AlertTriangle } from 'lucide-react';

interface ContractorAssignmentBlockerProps {
  reason?: string;
}

export function ContractorAssignmentBlocker({ reason = 'A critical compliance document has expired.' }: ContractorAssignmentBlockerProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Contractor cannot be assigned to new jobs.</p>
          <p>{reason} Renew the document before assigning this contractor.</p>
        </div>
      </div>
    </div>
  );
}

export default ContractorAssignmentBlocker;
