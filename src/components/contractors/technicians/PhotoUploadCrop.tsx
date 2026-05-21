import { Camera } from 'lucide-react';

interface PhotoUploadCropProps {
  photoUrl?: string;
}

export function PhotoUploadCrop({ photoUrl }: PhotoUploadCropProps) {
  return (
    <label className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
      {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full rounded-full object-cover" /> : <Camera className="mb-2 h-6 w-6 text-blue-600" />}
      {!photoUrl && 'Upload photo'}
      <input type="file" accept="image/png,image/jpeg" className="hidden" />
    </label>
  );
}

export default PhotoUploadCrop;
