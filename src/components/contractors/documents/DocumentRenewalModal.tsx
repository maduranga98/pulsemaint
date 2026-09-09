import { useTranslation } from 'react-i18next';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import DocumentUploadModal from './DocumentUploadModal';

interface DocumentRenewalModalProps {
  document: ContractorDocument | null;
  contractorId?: string;
  onClose: () => void;
}

export function DocumentRenewalModal({ document, contractorId, onClose }: DocumentRenewalModalProps) {
  const { t } = useTranslation();
  return (
    <DocumentUploadModal
      key={document?.id ?? 'renew-empty'}
      open={Boolean(document)}
      onClose={onClose}
      contractorId={contractorId}
      renewalOf={document}
      title={
        document
          ? t('common.contractors.documents.renewalModal.titleWithName', { name: document.documentName })
          : t('common.contractors.documents.renewalModal.title')
      }
    />
  );
}

export default DocumentRenewalModal;
