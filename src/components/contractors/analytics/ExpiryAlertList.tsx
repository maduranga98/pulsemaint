import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import { DOCUMENT_TYPE_LABELS } from '@/lib/contractors/contractorTypes';
import DocumentStatusBadge from '@/components/contractors/documents/DocumentStatusBadge';

interface ExpiryAlertListProps {
  documents: ContractorDocument[];
}

export function ExpiryAlertList({ documents }: ExpiryAlertListProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-950">Expiring within 30 days</h2>
      <div className="mt-3 space-y-2">
        {documents.length ? documents.map((document) => (
          <div key={document.id} className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-900">{document.documentName}</p>
              <p className="text-xs text-slate-500">{DOCUMENT_TYPE_LABELS[document.documentType]}</p>
            </div>
            <DocumentStatusBadge document={document} />
          </div>
        )) : <p className="text-sm text-slate-500">No documents expiring soon.</p>}
      </div>
    </section>
  );
}

export default ExpiryAlertList;
