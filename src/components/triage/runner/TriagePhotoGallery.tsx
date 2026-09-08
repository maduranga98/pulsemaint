import { useTranslation } from 'react-i18next';

interface Props {
  photoUrls: string[];
}

export default function TriagePhotoGallery({ photoUrls }: Props) {
  const { t } = useTranslation();
  if (photoUrls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {photoUrls.map((url, i) => (
        <img
          key={i}
          src={url}
          alt={t('triage.photo_alt', { index: i + 1 })}
          className="w-20 h-20 object-cover rounded-lg border border-gray-200"
        />
      ))}
    </div>
  );
}
