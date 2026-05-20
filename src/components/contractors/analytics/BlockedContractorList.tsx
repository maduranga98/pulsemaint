import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import { DOCUMENT_TYPE_LABELS } from '@/lib/contractors/contractorTypes';

interface BlockedContractorListProps {
  documents: ContractorDocument[];
}

export function BlockedContractorList({ documents }: BlockedContractorListProps) {
  if (!documents.length) return null;

  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="font-semibold text-red-900">Expired & Blocking Assignment</h2>
      <div className="mt-3 space-y-2">
        {documents.map((document) => (
          <div key={document.id} className="rounded-md bg-white p-3 text-sm">
            <p className="font-semibold text-slate-900">{document.documentName}</p>
            <p className="text-red-700">{DOCUMENT_TYPE_LABELS[document.documentType]} expired {Math.abs(document.daysUntilExpiry ?? 0)} days ago</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default BlockedContractorList;
