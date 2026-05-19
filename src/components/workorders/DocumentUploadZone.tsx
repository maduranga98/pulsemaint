import { useRef, useState } from 'react';
import type { WODocument } from '../../types/workOrder';
import { WO_COPY } from '../../constants/copy';

const MAX_TOTAL_BYTES = 500 * 1024 * 1024; // 500 MB

const ACCEPT_MAP: Record<WODocument['fileType'], string> = {
  cad:        '.dwg,.dxf,.step,.stp,.iges,.igs,.stl',
  document:   '.pdf,.docx,.xlsx,.pptx,.txt',
  image:      '.jpg,.jpeg,.png,.webp,.heic',
  video:      '.mp4,.mov,.avi',
  compressed: '.zip,.rar',
  sop_link:   '',
};

const FILE_MAX: Record<WODocument['fileType'], number> = {
  cad:        100 * 1024 * 1024,
  document:   100 * 1024 * 1024,
  image:       50 * 1024 * 1024,
  video:       50 * 1024 * 1024,
  compressed: 200 * 1024 * 1024,
  sop_link:   0,
};

function getFileType(file: File): WODocument['fileType'] {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl'].includes(ext)) return 'cad';
  if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) return 'image';
  if (['zip', 'rar'].includes(ext)) return 'compressed';
  return 'document';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface PendingFile {
  file: File;
  fileType: WODocument['fileType'];
  error?: string;
}

interface DocumentUploadZoneProps {
  pendingFiles: PendingFile[];
  uploadedDocs: WODocument[];
  onAddFiles: (files: PendingFile[]) => void;
  onRemovePending: (index: number) => void;
  onRemoveUploaded?: (id: string) => void;
  progress?: Record<string, number>;
}

const TYPE_ICON: Record<WODocument['fileType'], string> = {
  cad:        '📐',
  document:   '📄',
  image:      '🖼️',
  video:      '🎬',
  compressed: '🗜️',
  sop_link:   '🔗',
};

export function DocumentUploadZone({
  pendingFiles,
  uploadedDocs,
  onAddFiles,
  onRemovePending,
  onRemoveUploaded,
  progress = {},
}: DocumentUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalUsed =
    pendingFiles.reduce((s, f) => s + f.file.size, 0) +
    uploadedDocs.reduce((s, d) => s + d.fileSize, 0);

  function validateAndAdd(fileList: FileList | null) {
    if (!fileList) return;
    const newPending: PendingFile[] = [];
    let running = totalUsed;

    for (const file of Array.from(fileList)) {
      const fileType = getFileType(file);
      let error: string | undefined;

      if (file.size > FILE_MAX[fileType]) {
        error = `Exceeds ${formatBytes(FILE_MAX[fileType])} limit`;
      } else if (running + file.size > MAX_TOTAL_BYTES) {
        error = '500 MB WO limit reached';
      } else {
        running += file.size;
      }

      newPending.push({ file, fileType, error });
    }

    onAddFiles(newPending);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    validateAndAdd(e.dataTransfer.files);
  }

  const usedPct = Math.min(100, Math.round((totalUsed / MAX_TOTAL_BYTES) * 100));

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        <p className="text-3xl mb-2">📁</p>
        <p className="text-sm font-medium text-gray-700">{WO_COPY.uploadHint}</p>
        <p className="text-xs text-gray-400 mt-1">
          CAD, PDF, Images, Video, ZIP supported
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={Object.values(ACCEPT_MAP).filter(Boolean).join(',')}
          className="hidden"
          onChange={(e) => validateAndAdd(e.target.files)}
        />
      </div>

      {/* Storage bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{WO_COPY.storageUsed(formatBytes(totalUsed))}</span>
          <span>{usedPct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${usedPct > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </div>

      {/* Pending + uploaded file list */}
      {(pendingFiles.length > 0 || uploadedDocs.length > 0) && (
        <div className="space-y-1.5">
          {pendingFiles.map((pf, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                pf.error ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
              }`}
            >
              <span className="text-xl flex-shrink-0">{TYPE_ICON[pf.fileType]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{pf.file.name}</p>
                {pf.error ? (
                  <p className="text-xs text-red-500">{pf.error}</p>
                ) : progress[pf.file.name] !== undefined ? (
                  <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${progress[pf.file.name]}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">{formatBytes(pf.file.size)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemovePending(i)}
                className="text-gray-400 hover:text-red-500 p-1"
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          ))}

          {uploadedDocs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-emerald-50">
              <span className="text-xl flex-shrink-0">{TYPE_ICON[doc.fileType]}</span>
              <div className="flex-1 min-w-0">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-emerald-700 hover:underline truncate block"
                >
                  {doc.name}
                </a>
                <p className="text-xs text-gray-400">{formatBytes(doc.fileSize)}</p>
              </div>
              {onRemoveUploaded && (
                <button
                  type="button"
                  onClick={() => onRemoveUploaded(doc.id)}
                  className="text-gray-400 hover:text-red-500 p-1"
                  aria-label="Remove file"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
