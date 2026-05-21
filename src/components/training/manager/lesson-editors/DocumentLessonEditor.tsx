import { useRef, useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { nanoid } from 'nanoid';
import { FileText, Upload, RefreshCw, CheckCircle2 } from 'lucide-react';

interface DocumentLessonEditorProps {
  contentUrl?: string;
  onUpdate: (updates: { contentUrl: string; pageCount: number }) => void;
}

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const ACCEPTED = '.pdf,.docx';

export default function DocumentLessonEditor({ contentUrl, onUpdate }: DocumentLessonEditorProps) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadedName, setUploadedName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [replacing, setReplacing] = useState(false);

  const hasExisting = !!contentUrl && !replacing;

  async function uploadFile(file: File) {
    if (!companyId) {
      setError('Company not found.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File exceeds 100 MB limit.');
      return;
    }

    setError('');
    setProgress(0);
    const ext = file.name.split('.').pop() ?? 'pdf';
    const storagePath = `companies/${companyId}/training-content/${nanoid()}.${ext}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setProgress(pct);
      },
      (err) => {
        setError(`Upload failed: ${err.message}`);
        setProgress(null);
      },
      async () => {
        const downloadUrl = await getDownloadURL(task.snapshot.ref);
        setUploadedName(file.name);
        setProgress(null);
        setReplacing(false);
        onUpdate({ contentUrl: downloadUrl, pageCount: 0 });
      }
    );
  }

  function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }

  if (hasExisting) {
    return (
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-emerald-700 truncate">Current document uploaded</p>
          <a
            href={contentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-emerald-600 hover:underline truncate block"
          >
            {contentUrl}
          </a>
        </div>
        <button
          type="button"
          onClick={() => setReplacing(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-blue-600 border border-gray-300 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors"
        >
          <RefreshCw size={13} />
          Replace
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        <FileText size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-700">Drop a document here or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">PDF, DOCX · Max 100 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {progress !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><Upload size={12} /> Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {uploadedName && progress === null && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 size={16} />
          <span>Document uploaded: {uploadedName}</span>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
