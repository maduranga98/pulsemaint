import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import { DOCUMENT_TYPE_LABELS } from '@/lib/contractors/contractorTypes';

interface DocumentHistoryAccordionProps {
  documentType: ContractorDocument['documentType'];
  documents: ContractorDocument[];
}

export function DocumentHistoryAccordion({ documentType, documents }: DocumentHistoryAccordionProps) {
  const [open, setOpen] = useState(false);
  if (documents.length <= 1) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800">
        {DOCUMENT_TYPE_LABELS[documentType]} history
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {documents.map((document) => (
            <div key={document.id} className="px-4 py-3 text-sm text-slate-600">
              <span className="font-medium text-slate-900">v{document.version}</span> - {document.documentName} - {document.uploadedAt.toDate().toLocaleDateString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentHistoryAccordion;
