import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContractorDocuments } from '@/hooks/contractors/useContractorDocuments';
import DocumentList from '@/components/contractors/documents/DocumentList';

export function ContractorDocumentsPage() {
  const { t } = useTranslation();
  const { contractorId } = useParams();
  const { documents, loading } = useContractorDocuments(contractorId);

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.documentsPage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('common.contractors.documentsPage.subtitle')}</p>
      </div>
      {loading ? <div className="text-slate-500">{t('common.contractors.documentsPage.loading')}</div> : <DocumentList documents={documents} contractorId={contractorId} />}
    </div>
  );
}

export default ContractorDocumentsPage;
