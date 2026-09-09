import { useTranslation } from 'react-i18next';
import { Download, Eye, RotateCcw } from 'lucide-react';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import { DOCUMENT_TYPE_LABELS } from '@/lib/contractors/contractorTypes';
import DocumentExpiryTimer from './DocumentExpiryTimer';
import DocumentStatusBadge from './DocumentStatusBadge';

interface DocumentCardProps {
  document: ContractorDocument;
  onRenew?: (document: ContractorDocument) => void;
}

export function DocumentCard({ document, onRenew }: DocumentCardProps) {
  const { t } = useTranslation();

  function dateText(value: ContractorDocument['expiryDate']) {
    return value ? value.toDate().toLocaleDateString() : t('common.contractors.documents.card.noExpiry');
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{DOCUMENT_TYPE_LABELS[document.documentType]}</p>
          <h3 className="mt-1 font-semibold text-slate-950">{document.documentName}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {t('common.contractors.documents.card.versionUploadedBy', {
              version: document.version,
              name: document.uploadedByName,
            })}
          </p>
        </div>
        <DocumentStatusBadge document={document} />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <span>{t('common.contractors.documents.card.issued', { date: dateText(document.issueDate) })}</span>
        <span>{t('common.contractors.documents.card.expiry', { date: dateText(document.expiryDate) })}</span>
        <DocumentExpiryTimer document={document} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={document.fileUrl} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
          <Download className="h-3.5 w-3.5" />
          {t('common.contractors.documents.card.actions.download')}
        </a>
        <a href={document.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
          <Eye className="h-3.5 w-3.5" />
          {t('common.contractors.documents.card.actions.preview')}
        </a>
        <button type="button" onClick={() => onRenew?.(document)} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
          <RotateCcw className="h-3.5 w-3.5" />
          {t('common.contractors.documents.card.actions.renew')}
        </button>
      </div>
    </article>
  );
}

export default DocumentCard;
