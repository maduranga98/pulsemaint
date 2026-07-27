import { useState, useRef, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import type { LessonItem, LessonProgress } from '@/lib/training/trainingTypes';

interface TextLessonProps {
  lesson: LessonItem;
  progress?: LessonProgress;
  onComplete: (lessonId: string) => void;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
}

export default function TextLesson({ lesson, progress, onComplete }: TextLessonProps) {
  const [canComplete, setCanComplete] = useState(progress?.completed ?? false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The manager's Text Lesson editor (TextLessonEditor.tsx / LessonEditorPanel.tsx)
  // writes the authored HTML body directly into `contentUrl` — it was never a
  // fetchable URL for this lesson type. Fetching it here always failed (Invalid
  // URL) and silently fell back to the short `description` field, so the actual
  // lesson body never rendered.
  const content = lesson.contentUrl || lesson.description || '';

  // "Mark as Read" was permanently stuck disabled for short lessons: it only
  // unlocked via a scroll event, but a short lesson never overflows its
  // container, so no scroll event ever fires and the technician could never
  // complete it. Once the content has rendered, unlock immediately if there
  // is nothing to scroll.
  useEffect(() => {
    if (canComplete) return;
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight) setCanComplete(true);
  }, [content, canComplete]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const scrolled = el.scrollTop + el.clientHeight;
    const threshold = el.scrollHeight * 0.9;
    if (scrolled >= threshold) setCanComplete(true);
  };

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
      >
        <div
          className="prose prose-slate max-w-none text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
        />
        {!content && (
          <p className="text-slate-400 italic">No content available for this lesson.</p>
        )}
        {/* Extra padding so user can scroll to bottom */}
        <div className="h-8" />
      </div>

      {/* Footer action */}
      <div className="bg-white border-t border-slate-200 px-4 py-3">
        {progress?.completed ? (
          <div className="flex items-center justify-center gap-2 text-green-600 font-medium py-2">
            <CheckCircle size={18} />
            You've marked this as read
          </div>
        ) : (
          <button
            onClick={() => canComplete && onComplete(lesson.id)}
            disabled={!canComplete}
            className={`w-full flex items-center justify-center gap-2 font-medium py-3 rounded-lg transition-colors ${
              canComplete
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            aria-label="Mark lesson as read"
          >
            <CheckCircle size={18} />
            {canComplete ? 'Mark as Read' : 'Scroll to bottom to complete'}
          </button>
        )}
      </div>
    </div>
  );
}
