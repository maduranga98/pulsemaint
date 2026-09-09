import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import { CONTRACTOR_DOCUMENT_TYPES } from '@/lib/contractors/contractorTypes';
import CriticalDocumentWarning from './CriticalDocumentWarning';
import DocumentCard from './DocumentCard';
import DocumentHistoryAccordion from './DocumentHistoryAccordion';
import DocumentRenewalModal from './DocumentRenewalModal';
import DocumentUploadModal from './DocumentUploadModal';

interface DocumentListProps {
  documents: ContractorDocument[];
  contractorId?: string;
}

export function DocumentList({ documents, contractorId }: DocumentListProps) {
  const { t } = useTranslation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renewDocument, setRenewDocument] = useState<ContractorDocument | null>(null);
  const activeDocuments = documents.filter((document) => !document.supersededBy);

  return (
    <div className="space-y-4">
      <CriticalDocumentWarning documents={documents} />
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">{t('common.contractors.documents.list.title')}</h2>
          <p className="text-sm text-slate-500">{t('common.contractors.documents.list.subtitle')}</p>
        </div>
        <button type="button" onClick={() => setUploadOpen(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
          {t('common.contractors.documents.list.actions.upload')}
        </button>
      </div>
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
        <span>{t('common.contractors.documents.list.legend.valid')}</span>
        <span>{t('common.contractors.documents.list.legend.expiringSoon')}</span>
        <span>{t('common.contractors.documents.list.legend.expired')}</span>
        <span>{t('common.contractors.documents.list.legend.noExpiry')}</span>
      </div>
      <div className="grid gap-3">
        {activeDocuments.length ? activeDocuments.map((document) => (
          <DocumentCard key={document.id} document={document} onRenew={setRenewDocument} />
        )) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">{t('common.contractors.documents.list.empty')}</div>
        )}
      </div>
      <div className="grid gap-3">
        {CONTRACTOR_DOCUMENT_TYPES.map((documentType) => {
          const versions = documents.filter((document) => document.documentType === documentType);
          return <DocumentHistoryAccordion key={documentType} documentType={documentType} documents={versions} />;
        })}
      </div>
      <DocumentUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} contractorId={contractorId} />
      <DocumentRenewalModal document={renewDocument} contractorId={contractorId} onClose={() => setRenewDocument(null)} />
    </div>
  );
}

export default DocumentList;
