import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import DocumentList from '@/components/contractors/documents/DocumentList';

interface ContractorDocumentsTabProps {
  documents: ContractorDocument[];
}

export function ContractorDocumentsTab({ documents }: ContractorDocumentsTabProps) {
  return <DocumentList documents={documents} />;
}

export default ContractorDocumentsTab;
