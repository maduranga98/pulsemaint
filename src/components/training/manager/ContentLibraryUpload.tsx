import { useState, useRef, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContentLibraryItem } from '@/lib/training/trainingTypes';
import { Upload, X, CheckCircle, AlertCircle, File } from 'lucide-react';

interface ContentLibraryUploadProps {
  onUploadComplete?: (itemId: string) => void;
}

type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

interface FileEntry {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  errorMessage: string | null;
}

const ACCEPTED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const ACCEPTED_EXTENSIONS =
  '.mp4,.mov,.avi,.pdf,.docx,.jpg,.jpeg,.png,.webp';

function detectType(
  mimeType: string
): ContentLibraryItem['type'] {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'document';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let counter = 0;
function makeId() {
  return `upload-${Date.now()}-${counter++}`;
}

export default function ContentLibraryUpload({
  onUploadComplete,
}: ContentLibraryUploadProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) =>
      ACCEPTED_MIME_TYPES.includes(f.type)
    );
    const newEntries: FileEntry[] = arr.map((f) => ({
      id: makeId(),
      file: f,
      progress: 0,
      status: 'pending',
      errorMessage: null,
    }));
    setEntries((prev) => [...prev, ...newEntries]);
    newEntries.forEach((e) => uploadFile(e));
  }

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const uploadFile = useCallback(
    async (entry: FileEntry) => {
      if (!companyId) return;
      const { file, id } = entry;

      updateEntry(id, { status: 'uploading', progress: 0 });

      const storePath = `companies/${companyId}/content/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const pct = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          updateEntry(id, { progress: pct });
        },
        (error) => {
          updateEntry(id, {
            status: 'error',
            errorMessage: error.message,
          });
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            const type = detectType(file.type);

            const docRef = await addDoc(
              collection(db, 'trainingContentLibrary'),
              {
                companyId,
                name: file.name,
                type,
                url,
                thumbnailUrl: type === 'image' ? url : '',
                fileSizeBytes: file.size,
                durationSeconds: 0,
                pageCount: 0,
                mimeType: file.type,
                tags: [],
                uploadedBy: userProfile?.id ?? '',
                uploadedAt: serverTimestamp(),
                usedInModules: [],
              }
            );

            updateEntry(id, { status: 'done', progress: 100 });
            onUploadComplete?.(docRef.id);
          } catch (err) {
            updateEntry(id, {
              status: 'error',
              errorMessage:
                err instanceof Error ? err.message : 'Save failed',
            });
          }
        }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId, userProfile?.id, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId]
  );

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-6 py-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <Upload
          className={`w-8 h-8 ${dragging ? 'text-blue-500' : 'text-gray-400'}`}
        />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            Drop files here or{' '}
            <span className="text-blue-600 underline">browse</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            MP4, MOV, AVI, PDF, DOCX, JPG, PNG, WEBP
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* File List */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <File className="w-5 h-5 text-gray-400 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {entry.file.name}
                  </p>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatBytes(entry.file.size)}
                  </span>
                </div>

                {entry.status === 'uploading' && (
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>
                )}

                {entry.status === 'error' && (
                  <p className="text-xs text-red-600 mt-0.5">
                    {entry.errorMessage ?? 'Upload failed'}
                  </p>
                )}
              </div>

              {/* Status icon */}
              <div className="flex-shrink-0">
                {entry.status === 'done' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {entry.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                {(entry.status === 'pending' || entry.status === 'uploading') && (
                  <span className="text-xs text-gray-500">
                    {entry.progress}%
                  </span>
                )}
              </div>

              {(entry.status === 'done' || entry.status === 'error') && (
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
