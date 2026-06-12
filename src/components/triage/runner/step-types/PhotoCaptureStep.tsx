import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TriageStep, TriageLanguage } from '../../../../types/triage';
import { useAuthStore } from '../../../../store/authStore';
import { uploadTriageMedia } from '../../../../lib/triage/triageMediaUpload';

interface Props {
  step: TriageStep;
  language: TriageLanguage;
  onComplete: (photoUrls: string[]) => void;
}

export default function PhotoCaptureStep({ step, language, onComplete }: Props) {
  const { t } = useTranslation();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  // photos holds permanent Storage download URLs (survive reload).
  const [photos, setPhotos] = useState<string[]>([]);
  // pending holds a local preview blob + the underlying File until "Use photo".
  const [pending, setPending] = useState<{ preview: string; file: File } | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const title = step.translations?.[language]?.title ?? step.title;
  const instruction = step.translations?.[language]?.instruction ?? step.instruction;

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPending({ preview, file });
    if (inputRef.current) inputRef.current.value = '';
  };

  const usePhoto = async () => {
    if (!pending) return;
    setUploading(true);
    try {
      const { url } = await uploadTriageMedia(pending.file, {
        companyId,
        folder: 'captures',
      });
      setPhotos((p) => [...p, url]);
      URL.revokeObjectURL(pending.preview);
      setPending(null);
    } catch (err) {
      console.error('PhotoCaptureStep upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const retake = () => {
    if (pending) URL.revokeObjectURL(pending.preview);
    setPending(null);
    inputRef.current?.click();
  };

  const canProceed = photos.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[22px] font-bold font-['Sora'] text-[#0A1628]">{title}</h2>
      <p className="text-[20px] leading-relaxed text-gray-700">{instruction}</p>

      {pending ? (
        <div className="flex flex-col items-center gap-3">
          <img src={pending.preview} alt="Preview" className="w-full max-h-64 object-cover rounded-xl border" />
          <div className="flex gap-3 w-full">
            <button
              onClick={retake}
              disabled={uploading}
              className="flex-1 min-h-[56px] border-2 border-gray-300 text-gray-700 text-[18px] font-medium rounded-xl hover:bg-gray-50 disabled:opacity-40"
            >
              {t('triage.retake')}
            </button>
            <button
              onClick={usePhoto}
              disabled={uploading}
              className="flex-1 min-h-[56px] bg-[#10B981] text-white text-[18px] font-semibold rounded-xl hover:bg-green-600 disabled:opacity-40"
            >
              {uploading ? t('triage.loading') : t('triage.use_photo')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <img key={i} src={url} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border" />
              ))}
            </div>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full min-h-[56px] border-2 border-dashed border-[#1A56DB] text-[#1A56DB] text-[18px] font-medium rounded-xl hover:bg-blue-50"
          >
            {photos.length > 0 ? t('triage.add_another_photo') : t('triage.capture_photo')}
          </button>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />

      {!canProceed && (
        <p className="text-sm text-amber-600">{t('triage.photo_required_hint')}</p>
      )}

      <button
        onClick={() => onComplete(photos)}
        disabled={!canProceed}
        className="w-full min-h-[56px] bg-[#1A56DB] text-white text-[18px] font-semibold rounded-xl mt-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 active:scale-[0.98] transition-all"
      >
        {t('triage.next_step')}
      </button>
    </div>
  );
}
