import { useRef, useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { nanoid } from 'nanoid';
import { Images, Upload, X, Plus, AlertCircle } from 'lucide-react';

export interface GalleryImage {
  url: string;
  caption: string;
}

interface UploadingImage {
  id: string;
  name: string;
  progress: number;
}

interface GalleryLessonEditorProps {
  images?: GalleryImage[];
  onUpdate: (images: GalleryImage[]) => void;
}

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB per image
const MAX_IMAGES = 20;
const ACCEPTED = '.jpg,.jpeg,.png,.webp';

export default function GalleryLessonEditor({ images = [], onUpdate }: GalleryLessonEditorProps) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState<UploadingImage[]>([]);
  const [error, setError] = useState<string>('');

  async function uploadSingleFile(file: File, _currentImages: GalleryImage[]): Promise<GalleryImage | null> {
    if (!companyId) return null;
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" exceeds 50 MB limit.`);
      return null;
    }

    const uploadId = nanoid(6);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const storagePath = `companies/${companyId}/training-content/${nanoid()}.${ext}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);

    setUploading((prev) => [...prev, { id: uploadId, name: file.name, progress: 0 }]);

    return new Promise((resolve) => {
      task.on(
        'state_changed',
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setUploading((prev) =>
            prev.map((u) => (u.id === uploadId ? { ...u, progress: pct } : u))
          );
        },
        () => {
          setUploading((prev) => prev.filter((u) => u.id !== uploadId));
          resolve(null);
        },
        async () => {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          setUploading((prev) => prev.filter((u) => u.id !== uploadId));
          resolve({ url: downloadUrl, caption: '' });
        }
      );
    });
  }

  async function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!companyId) {
      setError('Company not found.');
      return;
    }

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

    setError('');
    const filesToUpload = Array.from(files).slice(0, remaining);

    const results = await Promise.all(filesToUpload.map((f) => uploadSingleFile(f, images)));
    const newImages = results.filter((r): r is GalleryImage => r !== null);
    onUpdate([...images, ...newImages]);
  }

  function handleCaptionChange(index: number, caption: string) {
    const updated = images.map((img, i) => (i === index ? { ...img, caption } : img));
    onUpdate(updated);
  }

  function handleRemove(index: number) {
    const updated = images.filter((_, i) => i !== index);
    onUpdate(updated);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add images button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={images.length >= MAX_IMAGES}
          className="flex items-center gap-2 border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Images
        </button>
        <span className="text-xs text-gray-400">{images.length}/{MAX_IMAGES} images</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {images.length >= MAX_IMAGES && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          Maximum {MAX_IMAGES} images reached.
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Upload progress indicators */}
      {uploading.length > 0 && (
        <div className="flex flex-col gap-2">
          {uploading.map((u) => (
            <div key={u.id} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                  <Upload size={12} className="flex-shrink-0" />
                  {u.name}
                </span>
                <span>{u.progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && uploading.length === 0 && (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <Images size={32} className="text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-500">Click to add images</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP · Max 50 MB each · Up to {MAX_IMAGES} images</p>
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img, index) => (
            <div key={`${img.url}-${index}`} className="flex flex-col gap-1.5 group">
              <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={img.url}
                  alt={img.caption || `Image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute top-1.5 right-1.5 p-1 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
              <input
                type="text"
                value={img.caption}
                onChange={(e) => handleCaptionChange(index, e.target.value)}
                placeholder="Add caption…"
                className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
