import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import type { LessonItem, LessonProgress } from '@/lib/training/trainingTypes';

interface GalleryImage {
  url: string;
  caption: string;
}

interface ImageGalleryLessonProps {
  lesson: LessonItem;
  progress?: LessonProgress;
  onComplete: (lessonId: string) => void;
}

function parseImages(lesson: LessonItem): GalleryImage[] {
  try {
    const parsed = JSON.parse(lesson.contentUrl) as GalleryImage[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // not JSON
  }
  if (lesson.contentUrl) {
    return [{ url: lesson.contentUrl, caption: lesson.title }];
  }
  return [];
}

export default function ImageGalleryLesson({
  lesson,
  progress,
  onComplete,
}: ImageGalleryLessonProps) {
  const images = parseImages(lesson);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewedAll, setViewedAll] = useState(progress?.completed ?? false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    if (currentIndex === images.length - 1 && images.length > 0) {
      setViewedAll(true);
    }
  }, [currentIndex, images.length]);

  const prev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const next = () => {
    const nextIdx = Math.min(images.length - 1, currentIndex + 1);
    setCurrentIndex(nextIdx);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
    setTouchStart(null);
  };

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No images available.
      </div>
    );
  }

  const current = images[currentIndex];

  return (
    <div className="flex flex-col h-full">
      {/* Image area */}
      <div
        className="flex-1 relative bg-black flex items-center justify-center select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={current.url}
          alt={current.caption}
          className="max-h-[60vh] max-w-full object-contain"
          draggable={false}
        />

        {/* Prev/Next buttons */}
        {currentIndex > 0 && (
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {currentIndex < images.length - 1 && (
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            aria-label="Next image"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Counter */}
        <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          {currentIndex + 1} of {images.length}
        </div>
      </div>

      {/* Caption + dots */}
      <div className="bg-white px-4 py-3 space-y-3">
        {current.caption && (
          <p className="text-sm text-slate-600 text-center">{current.caption}</p>
        )}

        {/* Dot navigation */}
        <div className="flex justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? 'bg-blue-600' : 'bg-slate-300'}`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>

        {/* Complete button */}
        {viewedAll && !progress?.completed && (
          <button
            onClick={() => onComplete(lesson.id)}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors"
          >
            <CheckCircle size={18} />
            Mark as Complete
          </button>
        )}
        {progress?.completed && (
          <div className="flex items-center justify-center gap-2 text-green-600 font-medium py-2">
            <CheckCircle size={18} />
            Completed
          </div>
        )}
        {!viewedAll && (
          <p className="text-xs text-slate-400 text-center">
            View all images to complete this lesson
          </p>
        )}
      </div>
    </div>
  );
}
