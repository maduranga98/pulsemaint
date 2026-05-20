import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import DocumentUploadModal from './DocumentUploadModal';

interface DocumentRenewalModalProps {
  document: ContractorDocument | null;
  onClose: () => void;
}

export function DocumentRenewalModal({ document, onClose }: DocumentRenewalModalProps) {
  return (
    <DocumentUploadModal
      open={Boolean(document)}
      onClose={onClose}
      title={document ? `Renew ${document.documentName}` : 'Renew Document'}
    />
  );
}

export default DocumentRenewalModal;
