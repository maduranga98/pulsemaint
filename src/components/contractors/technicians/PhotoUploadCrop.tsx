import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';

interface PhotoUploadCropProps {
  photoUrl?: string;
  onFileSelect?: (file: File | null) => void;
}

export function PhotoUploadCrop({ photoUrl, onFileSelect }: PhotoUploadCropProps) {
  const [preview, setPreview] = useState<string | undefined>(photoUrl);

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onFileSelect?.(file);
    if (file) setPreview(URL.createObjectURL(file));
  }

  return (
    <label className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
      {preview ? <img src={preview} alt="" className="h-full w-full rounded-full object-cover" /> : <Camera className="mb-2 h-6 w-6 text-blue-600" />}
      {!preview && 'Upload photo'}
      <input type="file" accept="image/png,image/jpeg" onChange={handleChange} className="hidden" />
    </label>
  );
}

export default PhotoUploadCrop;
