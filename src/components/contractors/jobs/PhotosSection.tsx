import { Camera } from 'lucide-react';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';

interface PhotosSectionProps {
  job: ContractorJob;
}

export function PhotosSection({ job }: PhotosSectionProps) {
  const photos = [...job.beforePhotoUrls, ...job.photoUrls, ...job.afterPhotoUrls];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">Photos & Documents</h2>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
          <Camera className="h-3.5 w-3.5" />
          Add Photos
          <input type="file" accept="image/*" multiple className="hidden" />
        </label>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {photos.length ? photos.map((photo) => <img key={photo} src={photo} alt="" className="aspect-square rounded-md object-cover" />) : <p className="col-span-full text-sm text-slate-500">No photos uploaded yet.</p>}
      </div>
    </section>
  );
}

export default PhotosSection;
