import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import DocumentList from '@/components/contractors/documents/DocumentList';

interface ContractorDocumentsTabProps {
  documents: ContractorDocument[];
  contractorId?: string;
}

export function ContractorDocumentsTab({ documents, contractorId }: ContractorDocumentsTabProps) {
  return <DocumentList documents={documents} contractorId={contractorId} />;
}

export default ContractorDocumentsTab;
