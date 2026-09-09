import { useTranslation } from 'react-i18next';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import { DOCUMENT_TYPE_LABELS } from '@/lib/contractors/contractorTypes';

interface BlockedContractorListProps {
  documents: ContractorDocument[];
}

export function BlockedContractorList({ documents }: BlockedContractorListProps) {
  const { t } = useTranslation();
  if (!documents.length) return null;

  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="font-semibold text-red-900">{t('common.contractors.analytics.blockedList.title')}</h2>
      <div className="mt-3 space-y-2">
        {documents.map((document) => (
          <div key={document.id} className="rounded-md bg-white p-3 text-sm">
            <p className="font-semibold text-slate-900">{document.documentName}</p>
            <p className="text-red-700">
              {t('common.contractors.analytics.blockedList.expiredDaysAgo', {
                documentType: DOCUMENT_TYPE_LABELS[document.documentType],
                days: Math.abs(document.daysUntilExpiry ?? 0),
              })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default BlockedContractorList;
