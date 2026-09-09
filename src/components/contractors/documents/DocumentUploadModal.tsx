import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { collection, doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { CONTRACTOR_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/contractors/contractorTypes';
import { deriveDocumentExpiry } from '@/lib/contractors/documentExpiryHelper';
import type { ContractorDocument, ContractorDocumentType } from '@/lib/contractors/contractorTypes';

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  contractorId?: string;
  title?: string;
  /** When set, this upload renews an existing document: the new file supersedes it. */
  renewalOf?: ContractorDocument | null;
}

export function DocumentUploadModal({ open, onClose, contractorId, title, renewalOf }: DocumentUploadModalProps) {
  const { t } = useTranslation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const params = useParams<{ contractorId?: string }>();
  // Resolve the contractor from every available source so renewals/uploads
  // never dead-end on "Missing contractor reference": the explicit prop, the
  // document being renewed, or the :contractorId route param.
  const effectiveContractorId = contractorId ?? renewalOf?.contractorId ?? params.contractorId;
  const [documentType, setDocumentType] = useState<ContractorDocumentType>(renewalOf?.documentType ?? CONTRACTOR_DOCUMENT_TYPES[0]);
  const [documentName, setDocumentName] = useState(renewalOf?.documentName ?? '');
  const [issueDate, setIssueDate] = useState(renewalOf ? new Date().toISOString().slice(0, 10) : '');
  // Renewals of dated documents default the new expiry to one year after the
  // current expiry (or after today if the document already lapsed), so the
  // renewal actually extends validity even if the user just hits Renew.
  const currentExpiry = renewalOf?.expiryDate ? renewalOf.expiryDate.toDate() : null;
  const defaultRenewalExpiry = () => {
    if (!renewalOf || renewalOf.isPermanent) return '';
    const base = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
    const next = new Date(base);
    next.setFullYear(next.getFullYear() + 1);
    return next.toISOString().slice(0, 10);
  };
  const [expiryDate, setExpiryDate] = useState(defaultRenewalExpiry);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  const modalTitle = title ?? t('common.contractors.documents.uploadModal.defaultTitle');

  function resetAndClose() {
    setDocumentName('');
    setIssueDate('');
    setExpiryDate('');
    setNotes('');
    setFile(null);
    onClose();
  }

  async function handleUpload() {
    if (!effectiveContractorId) {
      toast.error(t('common.contractors.documents.uploadModal.errors.missingContractor'));
      return;
    }
    const targetContractorId = effectiveContractorId;
    if (!userProfile?.companyId) {
      toast.error(t('common.contractors.documents.uploadModal.errors.mustBeLoggedIn'));
      return;
    }
    // Renewals may keep the existing file — the point of renewing is the new
    // validity dates. Fresh uploads still need a file.
    if (!file && !renewalOf) {
      toast.error(t('common.contractors.documents.uploadModal.errors.fileRequired'));
      return;
    }
    if (renewalOf && !renewalOf.isPermanent && expiryDate === '') {
      toast.error(t('common.contractors.documents.uploadModal.errors.expiryRequired'));
      return;
    }
    setUploading(true);
    try {
      let url = renewalOf?.fileUrl ?? '';
      let path = renewalOf?.storagePath ?? '';
      let fileName = renewalOf?.fileName ?? '';
      let fileSizeBytes = renewalOf?.fileSizeBytes ?? 0;
      let mimeType = renewalOf?.mimeType ?? 'application/octet-stream';
      if (file) {
        path = `contractors/${targetContractorId}/documents/${Date.now()}_${file.name}`;
        const sref = storageRef(storage, path);
        await uploadBytes(sref, file);
        url = await getDownloadURL(sref);
        fileName = file.name;
        fileSizeBytes = file.size;
        mimeType = file.type || 'application/octet-stream';
      }
      const hasExpiry = expiryDate !== '';
      const expiry = hasExpiry ? new Date(expiryDate) : null;
      const derived = deriveDocumentExpiry(expiry, !hasExpiry, documentType);
      // Atomic write: the new (renewed) version and the supersede marker on
      // the old version either both persist or neither does — a half-applied
      // renewal used to leave the expired document still active.
      const batch = writeBatch(db);
      const newDocRef = doc(collection(db, 'contractors', targetContractorId, 'documents'));
      batch.set(newDocRef, {
        companyId: userProfile.companyId,
        contractorId: targetContractorId,
        documentType,
        documentName: documentName.trim() || fileName,
        fileName,
        fileUrl: url,
        storagePath: path,
        fileSizeBytes,
        mimeType,
        issueDate: issueDate !== '' ? Timestamp.fromDate(new Date(issueDate)) : null,
        expiryDate: expiry ? Timestamp.fromDate(expiry) : null,
        isPermanent: !hasExpiry,
        hasExpiry,
        daysUntilExpiry: derived.daysUntilExpiry,
        validityStatus: derived.validityStatus,
        isCriticalDocument: (renewalOf?.isCriticalDocument ?? false) || derived.isCriticalDocument,
        blocksAssignment: derived.blocksAssignment,
        version: (renewalOf?.version ?? 0) + 1,
        supersededBy: null,
        notes: notes.trim() || null,
        uploadedAt: serverTimestamp(),
        uploadedBy: userProfile.id ?? null,
        uploadedByName: userProfile.fullName ?? null,
      });

      if (renewalOf) {
        batch.update(doc(db, 'contractors', targetContractorId, 'documents', renewalOf.id), {
          supersededBy: newDocRef.id,
        });
      }
      await batch.commit();

      toast.success(
        renewalOf
          ? expiry
            ? t('common.contractors.documents.uploadModal.toasts.renewedWithDate', { date: expiry.toLocaleDateString() })
            : t('common.contractors.documents.uploadModal.toasts.renewed')
          : t('common.contractors.documents.uploadModal.toasts.uploaded'),
      );
      resetAndClose();
    } catch (err) {
      console.error('Document upload failed', err);
      toast.error(err instanceof Error ? err.message : t('common.contractors.documents.uploadModal.errors.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-xl rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">{modalTitle}</h2>
          <button type="button" onClick={resetAndClose} className="text-sm font-semibold text-slate-500">{t('common.contractors.documents.uploadModal.actions.close')}</button>
        </div>
        <div className="mt-4 grid gap-3">
          {renewalOf && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t('common.contractors.documents.uploadModal.currentValidity.label')}{' '}
              <strong>
                {currentExpiry
                  ? t('common.contractors.documents.uploadModal.currentValidity.expires', { date: currentExpiry.toLocaleDateString() })
                  : t('common.contractors.documents.uploadModal.currentValidity.noExpiry')}
              </strong>
              . {t('common.contractors.documents.uploadModal.currentValidity.hint')}
            </div>
          )}
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as ContractorDocumentType)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm"
          >
            {CONTRACTOR_DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>)}
          </select>
          <input
            placeholder={t('common.contractors.documents.uploadModal.fields.documentName')}
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              {t('common.contractors.documents.uploadModal.fields.issueDate')}
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
            </label>
            <label className="text-xs text-slate-500">
              {t('common.contractors.documents.uploadModal.fields.expiryDate')}
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
            </label>
          </div>
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
            <Upload className="mb-2 h-6 w-6 text-blue-600" />
            {file
              ? file.name
              : renewalOf
                ? t('common.contractors.documents.uploadModal.fileArea.renewalHint')
                : t('common.contractors.documents.uploadModal.fileArea.uploadHint')}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          <textarea
            placeholder={t('common.contractors.documents.uploadModal.fields.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploading
              ? t('common.contractors.documents.uploadModal.actions.saving')
              : renewalOf
                ? t('common.contractors.documents.uploadModal.actions.renew')
                : t('common.contractors.documents.uploadModal.actions.upload')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DocumentUploadModal;
