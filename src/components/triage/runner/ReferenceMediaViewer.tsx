import type { TriageMediaRef } from '../../../types/triage';

interface Props {
  media: TriageMediaRef;
  onClose: () => void;
}

export default function ReferenceMediaViewer({ media, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white text-3xl"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      {media.type === 'image' ? (
        <img
          src={media.url}
          alt={media.caption}
          className="max-w-full max-h-[80vh] rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <video
          src={media.url}
          controls
          className="max-w-full max-h-[80vh] rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {media.caption && (
        <p className="text-white text-sm mt-3 px-6 text-center">{media.caption}</p>
      )}
    </div>
  );
}
