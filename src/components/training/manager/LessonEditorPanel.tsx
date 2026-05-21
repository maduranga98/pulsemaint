import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Video, FileText, Images, AlignLeft } from 'lucide-react';
import type { LessonItem, LessonType } from '@/lib/training/trainingTypes';
import VideoLessonEditor from './lesson-editors/VideoLessonEditor';
import DocumentLessonEditor from './lesson-editors/DocumentLessonEditor';
import GalleryLessonEditor, { type GalleryImage } from './lesson-editors/GalleryLessonEditor';
import TextLessonEditor from './lesson-editors/TextLessonEditor';

interface LessonEditorPanelProps {
  lesson?: Partial<LessonItem>;
  onSave: (lesson: Partial<LessonItem>) => void;
  onCancel: () => void;
}

const TYPE_OPTIONS: { value: LessonType; label: string; icon: React.ReactNode }[] = [
  { value: 'video', label: 'Video', icon: <Video size={15} /> },
  { value: 'document', label: 'Document', icon: <FileText size={15} /> },
  { value: 'image_gallery', label: 'Gallery', icon: <Images size={15} /> },
  { value: 'text', label: 'Text', icon: <AlignLeft size={15} /> },
];

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default function LessonEditorPanel({ lesson, onSave, onCancel }: LessonEditorPanelProps) {
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [type, setType] = useState<LessonType>(lesson?.type ?? 'video');
  const [description, setDescription] = useState(lesson?.description ?? '');
  const [isRequired, setIsRequired] = useState(lesson?.isRequired ?? true);
  const [contentUrl, setContentUrl] = useState(lesson?.contentUrl ?? '');
  const [durationSeconds, setDurationSeconds] = useState(lesson?.durationSeconds ?? 0);
  const [thumbnailUrl, setThumbnailUrl] = useState(lesson?.thumbnailUrl ?? '');
  const [pageCount, setPageCount] = useState(lesson?.pageCount ?? 0);
  const [textContent, setTextContent] = useState(lesson?.contentUrl ?? '');
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(() => {
    if (lesson?.type === 'image_gallery' && lesson.contentUrl) {
      try {
        return JSON.parse(lesson.contentUrl) as GalleryImage[];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [titleError, setTitleError] = useState('');

  function handleSave() {
    if (!title.trim()) {
      setTitleError('Lesson title is required.');
      return;
    }
    setTitleError('');

    let resolvedContentUrl = contentUrl;
    if (type === 'text') {
      resolvedContentUrl = textContent;
    } else if (type === 'image_gallery') {
      resolvedContentUrl = JSON.stringify(galleryImages);
    }

    const saved: Partial<LessonItem> = {
      id: lesson?.id ?? nanoid(),
      title: title.trim(),
      type,
      description,
      isRequired,
      contentUrl: resolvedContentUrl,
      durationSeconds,
      thumbnailUrl,
      pageCount,
      subtitleUrl: lesson?.subtitleUrl ?? '',
      order: lesson?.order ?? 0,
    };

    onSave(saved);
  }

  function handleTypeChange(newType: LessonType) {
    setType(newType);
    // Reset content fields when switching types
    setContentUrl('');
    setDurationSeconds(0);
    setThumbnailUrl('');
    setPageCount(0);
    setTextContent('');
    setGalleryImages([]);
  }

  return (
    <div className="flex flex-col gap-5 p-5 bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">
          {lesson?.id ? 'Edit Lesson' : 'New Lesson'}
        </h3>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Lesson Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(''); }}
          placeholder="e.g. Machine Safety Overview"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {titleError && <p className="text-xs text-red-500">{titleError}</p>}
      </div>

      {/* Type segmented control */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Lesson Type</label>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTypeChange(opt.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                type === opt.value
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Brief description of this lesson…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Is Required */}
      <ToggleSwitch
        checked={isRequired}
        onChange={setIsRequired}
        label="Required to complete"
      />

      {/* Content upload section */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Content</label>

        {type === 'video' && (
          <VideoLessonEditor
            contentUrl={contentUrl}
            onUpdate={(updates) => {
              setContentUrl(updates.contentUrl);
              setDurationSeconds(updates.durationSeconds);
              setThumbnailUrl(updates.thumbnailUrl);
            }}
          />
        )}

        {type === 'document' && (
          <DocumentLessonEditor
            contentUrl={contentUrl}
            onUpdate={(updates) => {
              setContentUrl(updates.contentUrl);
              setPageCount(updates.pageCount);
            }}
          />
        )}

        {type === 'image_gallery' && (
          <GalleryLessonEditor
            images={galleryImages}
            onUpdate={setGalleryImages}
          />
        )}

        {type === 'text' && (
          <TextLessonEditor
            content={textContent}
            onChange={setTextContent}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2 px-5 text-sm transition-colors"
        >
          Save Lesson
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 sm:flex-none border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium rounded-lg py-2 px-5 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
