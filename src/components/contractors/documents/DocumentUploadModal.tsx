import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
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

export function DocumentUploadModal({ open, onClose, contractorId, title = 'Upload Document', renewalOf }: DocumentUploadModalProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const params = useParams<{ contractorId?: string }>();
  // Resolve the contractor from every available source so renewals/uploads
  // never dead-end on "Missing contractor reference": the explicit prop, the
  // document being renewed, or the :contractorId route param.
  const effectiveContractorId = contractorId ?? renewalOf?.contractorId ?? params.contractorId;
  const [documentType, setDocumentType] = useState<ContractorDocumentType>(renewalOf?.documentType ?? CONTRACTOR_DOCUMENT_TYPES[0]);
  const [documentName, setDocumentName] = useState(renewalOf?.documentName ?? '');
  const [issueDate, setIssueDate] = useState(renewalOf ? new Date().toISOString().slice(0, 10) : '');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

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
      toast.error('Missing contractor reference. Cannot upload.');
      return;
    }
    const targetContractorId = effectiveContractorId;
    if (!userProfile?.companyId) {
      toast.error('You must be logged in to upload documents.');
      return;
    }
    // Renewals may keep the existing file — the point of renewing is the new
    // validity dates. Fresh uploads still need a file.
    if (!file && !renewalOf) {
      toast.error('Please choose a file to upload.');
      return;
    }
    if (renewalOf && !renewalOf.isPermanent && expiryDate === '') {
      toast.error('Please set the new expiry date for the renewed document.');
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
      const newDocRef = await addDoc(collection(db, 'contractors', targetContractorId, 'documents'), {
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
        await updateDoc(doc(db, 'contractors', targetContractorId, 'documents', renewalOf.id), {
          supersededBy: newDocRef.id,
        });
      }

      toast.success(renewalOf ? 'Document renewed' : 'Document uploaded');
      resetAndClose();
    } catch (err) {
      console.error('Document upload failed', err);
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-xl rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <button type="button" onClick={resetAndClose} className="text-sm font-semibold text-slate-500">Close</button>
        </div>
        <div className="mt-4 grid gap-3">
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as ContractorDocumentType)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm"
          >
            {CONTRACTOR_DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>)}
          </select>
          <input
            placeholder="Document name"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Issue date
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
            </label>
            <label className="text-xs text-slate-500">
              Expiry date (leave blank if permanent)
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
            </label>
          </div>
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
            <Upload className="mb-2 h-6 w-6 text-blue-600" />
            {file ? file.name : renewalOf ? 'Optional: replace the file (current file is kept if none chosen)' : 'PDF, DOCX, JPG or PNG up to 50MB'}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          <textarea
            placeholder="Notes"
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
            {uploading ? 'Saving…' : renewalOf ? 'Renew Document' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DocumentUploadModal;
