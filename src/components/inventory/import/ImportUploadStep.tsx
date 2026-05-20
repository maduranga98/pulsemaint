import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, FileSpreadsheet, X, ChevronLeft } from 'lucide-react';

interface ImportUploadStepProps {
  onFileSelected: (file: File) => void;
  onBack: () => void;
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ImportUploadStep({ onFileSelected, onBack }: ImportUploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateAndSet(f: File) {
    setError(null);
    if (!f.name.endsWith('.xlsx')) {
      setError('Only .xlsx files are accepted. Please select a valid Excel file.');
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      setError(`File exceeds 10 MB limit (${formatBytes(f.size)}). Please reduce the file size.`);
      return;
    }
    setFile(f);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) validateAndSet(selected);
    e.target.value = '';
  }

  function handleRemove() {
    setFile(null);
    setError(null);
  }

  function handleUpload() {
    if (file) onFileSelected(file);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 font-[Sora]">Upload Your File</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Upload the completed template. Only .xlsx files, max 10 MB.
        </p>
      </div>

      {/* Drop zone */}
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-xl cursor-pointer transition-colors
            ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40'}
          `}
        >
          <Upload className={`w-10 h-10 ${dragActive ? 'text-blue-600' : 'text-gray-400'}`} />
          <div className="text-center">
            <p className="font-semibold text-gray-700">
              {dragActive ? 'Drop your file here' : 'Drag & drop your .xlsx file here'}
            </p>
            <p className="text-sm text-gray-500 mt-1">or click to browse files</p>
          </div>
          <span className="text-xs text-gray-400">Max 10 MB · .xlsx only</span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleChange}
          />
        </div>
      ) : (
        <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <FileSpreadsheet className="w-8 h-8 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{file.name}</p>
            <p className="text-sm text-gray-500">{formatBytes(file.size)}</p>
          </div>
          <button
            onClick={handleRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleUpload}
          disabled={!file}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
        >
          <Upload className="w-4 h-4" />
          Upload &amp; Validate
        </button>
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-3 text-gray-600 hover:text-gray-900 text-sm font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    </div>
  );
}
