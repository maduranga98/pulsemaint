import { FileText, Upload, X } from 'lucide-react';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';

interface ContractorFormSection5Props {
  files?: File[];
  existingDocuments?: ContractorDocument[];
  onAddFiles?: (files: File[]) => void;
  onRemoveFile?: (index: number) => void;
}

export function ContractorFormSection5({ files = [], existingDocuments = [], onAddFiles, onRemoveFile }: ContractorFormSection5Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    onAddFiles?.(Array.from(list));
    e.target.value = '';
  }

  return (
    <section className="space-y-4" id="contractor-form-documents">
      <h2 className="text-lg font-semibold text-slate-950">Initial Documents</h2>

      {existingDocuments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Already uploaded</p>
          <ul className="space-y-1 text-sm">
            {existingDocuments.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-slate-700">
                  <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="truncate">{document.documentName || document.fileName}</span>
                </span>
                {document.fileUrl && (
                  <a
                    href={document.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    View
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
        <Upload className="mb-2 h-7 w-7 text-blue-600" />
        Drag files here or choose PDF, DOCX, JPG, PNG
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={handleChange}
          className="hidden"
        />
      </label>
      {files.length > 0 && (
        <ul className="space-y-1 text-sm" aria-label="New uploads">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
              <span className="truncate text-slate-700">{f.name} <span className="text-xs text-slate-400">({Math.round(f.size / 1024)} KB)</span></span>
              <button
                type="button"
                onClick={() => onRemoveFile?.(i)}
                className="text-slate-400 hover:text-red-600"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
        You can add more documents from the contractor profile later.
      </div>
    </section>
  );
}

export default ContractorFormSection5;
