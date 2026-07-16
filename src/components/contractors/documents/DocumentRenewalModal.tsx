import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import DocumentUploadModal from './DocumentUploadModal';

interface DocumentRenewalModalProps {
  document: ContractorDocument | null;
  contractorId?: string;
  onClose: () => void;
}

export function DocumentRenewalModal({ document, contractorId, onClose }: DocumentRenewalModalProps) {
  return (
    <DocumentUploadModal
      key={document?.id ?? 'renew-empty'}
      open={Boolean(document)}
      onClose={onClose}
      contractorId={contractorId}
      renewalOf={document}
      title={document ? `Renew ${document.documentName}` : 'Renew Document'}
    />
  );
}

export default DocumentRenewalModal;
