import { useRef } from 'react';
import { Camera, Video, Paperclip, X } from 'lucide-react';
import type { WorkOrder } from '../../../types/workOrder';
import { useWOMedia } from '../../../hooks/useWOMedia';

interface MediaCaptureBarProps {
  workOrder: WorkOrder;
  siteId: string;
  enabled?: boolean;
}

const FORMAT_ICON: Record<string, string> = {
  cad: '📐',
  document: '📄',
  compressed: '🗜️',
  sop_link: '🔗',
};

export function MediaCaptureBar({ workOrder, siteId, enabled = true }: MediaCaptureBarProps) {
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { uploadMedia, removeMedia, progress, uploading } = useWOMedia();

  const fieldDocs = (workOrder.documents ?? []).filter((d) => !d.isCompletionDocument);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    await uploadMedia(workOrder.id, siteId, files);
  }

  const disabled = !enabled || uploading;

  return (
    <div className="space-y-3">
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFiles} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={handleFiles} />
      <input ref={fileRef} type="file" multiple hidden onChange={handleFiles} />

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => photoRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-2 py-3 text-xs font-medium text-[#F0F4F8] hover:border-[#00C2FF] disabled:opacity-50"
        >
          <Camera className="h-5 w-5 text-[#00C2FF]" />
          Take Photo
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => videoRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-2 py-3 text-xs font-medium text-[#F0F4F8] hover:border-[#00C2FF] disabled:opacity-50"
        >
          <Video className="h-5 w-5 text-[#00C2FF]" />
          Record Video
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-2 py-3 text-xs font-medium text-[#F0F4F8] hover:border-[#00C2FF] disabled:opacity-50"
        >
          <Paperclip className="h-5 w-5 text-[#00C2FF]" />
          Attach File
        </button>
      </div>

      {progress.length > 0 && (
        <div className="space-y-1.5">
          {progress.map((p) => (
            <div key={p.fileName}>
              <div className="flex justify-between text-[10px] text-[#8BA3BF]">
                <span className="truncate">{p.fileName}</span>
                <span>{p.progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1E3A5F]">
                <div className="h-1.5 rounded-full bg-[#00C2FF] transition-all" style={{ width: `${p.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {fieldDocs.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {fieldDocs.map((d) => (
            <div key={d.id} className="group relative aspect-square overflow-hidden rounded-lg border border-[#1E3A5F] bg-[#0A1628]">
              {d.fileType === 'image' ? (
                <img src={d.url} alt={d.name} className="h-full w-full object-cover" />
              ) : d.fileType === 'video' ? (
                <video src={d.url} muted className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
                  <span className="text-2xl">{FORMAT_ICON[d.fileType] ?? '📄'}</span>
                  <span className="w-full truncate text-[9px] text-[#8BA3BF]">{d.format || d.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeMedia(workOrder.id, workOrder.documents ?? [], d.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
