import { useState } from 'react';
import { Upload } from 'lucide-react';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { CONTRACTOR_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/contractors/contractorTypes';
import type { ContractorDocumentType } from '@/lib/contractors/contractorTypes';

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  contractorId?: string;
  title?: string;
}

export function DocumentUploadModal({ open, onClose, contractorId, title = 'Upload Document' }: DocumentUploadModalProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [documentType, setDocumentType] = useState<ContractorDocumentType>(CONTRACTOR_DOCUMENT_TYPES[0]);
  const [documentName, setDocumentName] = useState('');
  const [issueDate, setIssueDate] = useState('');
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
    if (!contractorId) {
      toast.error('Missing contractor reference. Cannot upload.');
      return;
    }
    if (!userProfile?.companyId) {
      toast.error('You must be logged in to upload documents.');
      return;
    }
    if (!file) {
      toast.error('Please choose a file to upload.');
      return;
    }
    setUploading(true);
    try {
      const path = `contractors/${contractorId}/documents/${Date.now()}_${file.name}`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      const hasExpiry = expiryDate !== '';
      await addDoc(collection(db, 'contractors', contractorId, 'documents'), {
        companyId: userProfile.companyId,
        contractorId,
        documentType,
        documentName: documentName.trim() || file.name,
        fileName: file.name,
        fileUrl: url,
        storagePath: path,
        fileSizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
        issueDate: issueDate !== '' ? Timestamp.fromDate(new Date(issueDate)) : null,
        expiryDate: hasExpiry ? Timestamp.fromDate(new Date(expiryDate)) : null,
        isPermanent: !hasExpiry,
        hasExpiry,
        validityStatus: 'valid',
        isCriticalDocument: false,
        blocksAssignment: false,
        version: 1,
        supersededBy: null,
        notes: notes.trim() || null,
        uploadedAt: serverTimestamp(),
        uploadedBy: userProfile.id ?? null,
        uploadedByName: userProfile.fullName ?? null,
      });
      toast.success('Document uploaded');
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
            {file ? file.name : 'PDF, DOCX, JPG or PNG up to 50MB'}
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
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DocumentUploadModal;
