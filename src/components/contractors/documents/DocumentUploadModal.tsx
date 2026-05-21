import { Upload } from 'lucide-react';
import { CONTRACTOR_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/contractors/contractorTypes';

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

export function DocumentUploadModal({ open, onClose, title = 'Upload Document' }: DocumentUploadModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-xl rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500">Close</button>
        </div>
        <div className="mt-4 grid gap-3">
          <select className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            {CONTRACTOR_DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>)}
          </select>
          <input placeholder="Document name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
            <input type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </div>
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
            <Upload className="mb-2 h-6 w-6 text-blue-600" />
            PDF, DOCX, JPG or PNG up to 50MB
            <input type="file" className="hidden" />
          </label>
          <textarea placeholder="Notes" className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <button type="button" className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Upload</button>
        </div>
      </div>
    </div>
  );
}

export default DocumentUploadModal;
