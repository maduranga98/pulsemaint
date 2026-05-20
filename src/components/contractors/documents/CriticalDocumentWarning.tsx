import { AlertTriangle } from 'lucide-react';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';

interface CriticalDocumentWarningProps {
  documents: ContractorDocument[];
}

export function CriticalDocumentWarning({ documents }: CriticalDocumentWarningProps) {
  const blocking = documents.filter((document) => !document.supersededBy && document.blocksAssignment);
  if (!blocking.length) return null;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Contractor cannot be assigned to new jobs until expired documents are renewed.</p>
          <p>{blocking.map((document) => document.documentName).join(', ')}</p>
        </div>
      </div>
    </div>
  );
}

export default CriticalDocumentWarning;
