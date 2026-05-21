import { useState } from 'react';
import { BookOpen, Loader2, Eye, ClipboardList } from 'lucide-react';
import type { TrainingModule, LessonItem } from '@/lib/training/trainingTypes';
import ModuleSettingsForm from './ModuleSettingsForm';
import LessonListEditor from './LessonListEditor';
import LessonEditorPanel from './LessonEditorPanel';

interface ModuleEditorLayoutProps {
  module?: TrainingModule;
  onSave: (updates: Partial<TrainingModule>) => Promise<void>;
  onPublish: () => Promise<void>;
  isSaving?: boolean;
  moduleId?: string;
}

type ActiveTab = 'settings' | 'lessons';

export default function ModuleEditorLayout({
  module,
  onSave,
  onPublish,
  isSaving = false,
  moduleId,
}: ModuleEditorLayoutProps) {
  const [lessons, setLessons] = useState<LessonItem[]>(module?.lessons ?? []);
  const [editingLesson, setEditingLesson] = useState<Partial<LessonItem> | null>(null);
  const [isNewLesson, setIsNewLesson] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ActiveTab>('settings');
  const [isPublishing, setIsPublishing] = useState(false);

  function handleAddLesson() {
    setEditingLesson({});
    setIsNewLesson(true);
    setSelectedLessonId(undefined);
    // On mobile, switch to lessons tab
    setActiveTab('lessons');
  }

  function handleEditLesson(lesson: LessonItem) {
    setEditingLesson(lesson);
    setIsNewLesson(false);
    setSelectedLessonId(lesson.id);
  }

  function handleSaveLesson(updated: Partial<LessonItem>) {
    let newLessons: LessonItem[];
    if (isNewLesson) {
      const newLesson: LessonItem = {
        id: updated.id ?? '',
        order: lessons.length + 1,
        title: updated.title ?? '',
        type: updated.type ?? 'video',
        contentUrl: updated.contentUrl ?? '',
        thumbnailUrl: updated.thumbnailUrl ?? '',
        description: updated.description ?? '',
        durationSeconds: updated.durationSeconds ?? 0,
        pageCount: updated.pageCount ?? 0,
        isRequired: updated.isRequired ?? true,
        subtitleUrl: updated.subtitleUrl ?? '',
      };
      newLessons = [...lessons, newLesson];
    } else {
      newLessons = lessons.map((l) =>
        l.id === updated.id ? ({ ...l, ...updated } as LessonItem) : l
      );
    }
    setLessons(newLessons);
    setEditingLesson(null);
    setIsNewLesson(false);
    setSelectedLessonId(updated.id);
    onSave({ lessons: newLessons });
  }

  function handleCancelLesson() {
    setEditingLesson(null);
    setIsNewLesson(false);
  }

  function handleReorder(reordered: LessonItem[]) {
    setLessons(reordered);
    onSave({ lessons: reordered });
  }

  function handleDeleteLesson(lessonId: string) {
    const updated = lessons
      .filter((l) => l.id !== lessonId)
      .map((l, i) => ({ ...l, order: i + 1 }));
    setLessons(updated);
    if (selectedLessonId === lessonId) {
      setSelectedLessonId(undefined);
      setEditingLesson(null);
    }
    onSave({ lessons: updated });
  }

  async function handlePublish() {
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  }

  const hasQuiz = !!module?.quiz;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      {/* Mobile tab switcher */}
      <div className="lg:hidden flex border-b border-gray-200 bg-white sticky top-0 z-10">
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Settings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('lessons')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'lessons'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Lessons {lessons.length > 0 && `(${lessons.length})`}
        </button>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 flex-col lg:flex-row gap-0 lg:gap-6 max-w-7xl mx-auto w-full p-4 lg:p-6">
        {/* Left panel: Settings */}
        <div
          className={`lg:w-80 flex-shrink-0 ${
            activeTab !== 'settings' ? 'hidden lg:block' : ''
          }`}
        >
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={18} className="text-blue-600" />
              <h2 className="text-base font-semibold text-gray-800">
                {module?.title || 'New Module'}
              </h2>
            </div>
            <ModuleSettingsForm
              defaultValues={module}
              onSubmit={onSave}
              isLoading={isSaving}
            />
          </div>
        </div>

        {/* Right panel: Lessons + Quiz */}
        <div
          className={`flex-1 min-w-0 flex flex-col gap-5 ${
            activeTab !== 'lessons' ? 'hidden lg:flex' : ''
          }`}
        >
          {/* Lessons section */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">
                Lessons
              </h2>
              <span className="text-xs text-gray-400">{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}</span>
            </div>

            <LessonListEditor
              lessons={lessons}
              onReorder={handleReorder}
              onEditLesson={handleEditLesson}
              onDeleteLesson={handleDeleteLesson}
              onAddLesson={handleAddLesson}
              selectedLessonId={selectedLessonId}
            />
          </div>

          {/* Lesson editor panel (inline) */}
          {editingLesson !== null && (
            <LessonEditorPanel
              lesson={editingLesson}
              onSave={handleSaveLesson}
              onCancel={handleCancelLesson}
            />
          )}

          {/* Quiz section */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-800">Quiz</h2>
            </div>

            {hasQuiz ? (
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <ClipboardList size={20} className="text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-700 truncate">
                    {module.quiz!.title || 'Untitled Quiz'}
                  </p>
                  <p className="text-xs text-blue-500">
                    {module.quiz!.questions.length} question{module.quiz!.questions.length !== 1 ? 's' : ''} ·
                    Pass {module.quiz!.passingScore}%
                  </p>
                </div>
                {moduleId && (
                  <a
                    href={`/training/modules/${moduleId}/quiz`}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-300 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
                  >
                    Edit Quiz
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <ClipboardList size={32} className="text-gray-200" />
                <div>
                  <p className="text-sm font-medium text-gray-500">No quiz yet</p>
                  <p className="text-xs text-gray-400">Add a quiz to assess learner understanding.</p>
                </div>
                {moduleId && (
                  <a
                    href={`/training/modules/${moduleId}/quiz`}
                    className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-300 hover:border-blue-400 rounded-lg px-4 py-2 transition-colors"
                  >
                    Add Quiz
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave({ status: 'draft' })}
            disabled={isSaving}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 font-medium rounded-lg py-2 px-4 text-sm transition-colors"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            Save Draft
          </button>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing || isSaving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2 px-4 text-sm transition-colors"
          >
            {isPublishing && <Loader2 size={14} className="animate-spin" />}
            Publish Module
          </button>
        </div>

        {moduleId && (
          <a
            href={`/training/modules/${moduleId}/preview`}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Eye size={15} />
            Preview
          </a>
        )}
      </div>
    </div>
  );
}
