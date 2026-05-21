import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Loader2, MessageSquare } from 'lucide-react';
import type { TrainingModule, TrainingQuiz, QuizQuestion } from '@/lib/training/trainingTypes';
import QuizSettingsBar from './QuizSettingsBar';
import QuestionListEditor from './QuestionListEditor';
import QuestionEditorPanel from './QuestionEditorPanel';

interface QuizBuilderLayoutProps {
  module: TrainingModule;
  onSaveQuiz: (quiz: TrainingQuiz) => Promise<void>;
  isSaving?: boolean;
}

function buildInitialQuiz(module: TrainingModule): TrainingQuiz {
  if (module.quiz) return module.quiz;
  return {
    id: nanoid(),
    title: `${module.title} Quiz`,
    instructions: '',
    timeLimit: 0,
    maxAttempts: 3,
    passingScore: module.passingScore,
    shuffleQuestions: false,
    shuffleOptions: false,
    questions: [],
  };
}

type ActiveTab = 'questions' | 'editor';

export default function QuizBuilderLayout({
  module,
  onSaveQuiz,
  isSaving = false,
}: QuizBuilderLayoutProps) {
  const [quiz, setQuiz] = useState<TrainingQuiz>(() => buildInitialQuiz(module));
  const [editingQuestion, setEditingQuestion] = useState<Partial<QuizQuestion> | null>(null);
  const [isNewQuestion, setIsNewQuestion] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ActiveTab>('questions');

  function handleQuizSettingsChange(updates: Partial<TrainingQuiz>) {
    setQuiz((prev) => ({ ...prev, ...updates }));
  }

  function handleAddQuestion() {
    setEditingQuestion({});
    setIsNewQuestion(true);
    setSelectedQuestionId(undefined);
    setActiveTab('editor');
  }

  function handleSelectQuestion(q: QuizQuestion) {
    setEditingQuestion(q);
    setIsNewQuestion(false);
    setSelectedQuestionId(q.id);
    setActiveTab('editor');
  }

  function handleSaveQuestion(saved: QuizQuestion) {
    let updatedQuestions: QuizQuestion[];
    if (isNewQuestion) {
      const newQ: QuizQuestion = {
        ...saved,
        order: quiz.questions.length + 1,
      };
      updatedQuestions = [...quiz.questions, newQ];
    } else {
      updatedQuestions = quiz.questions.map((q) =>
        q.id === saved.id ? { ...saved, order: q.order } : q
      );
    }
    setQuiz((prev) => ({ ...prev, questions: updatedQuestions }));
    setEditingQuestion(null);
    setIsNewQuestion(false);
    setSelectedQuestionId(saved.id);
    setActiveTab('questions');
  }

  function handleCancelQuestion() {
    setEditingQuestion(null);
    setIsNewQuestion(false);
    setActiveTab('questions');
  }

  function handleDeleteQuestion(id: string) {
    const updated = quiz.questions
      .filter((q) => q.id !== id)
      .map((q, i) => ({ ...q, order: i + 1 }));
    setQuiz((prev) => ({ ...prev, questions: updated }));
    if (selectedQuestionId === id) {
      setSelectedQuestionId(undefined);
      setEditingQuestion(null);
    }
  }

  function handleReorderQuestions(questions: QuizQuestion[]) {
    setQuiz((prev) => ({ ...prev, questions }));
  }

  async function handleSave() {
    await onSaveQuiz(quiz);
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-6">
      {/* Header with save button */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{module.title}</h1>
          <p className="text-xs text-gray-400">Quiz Builder</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2 px-4 text-sm transition-colors"
        >
          {isSaving && <Loader2 size={14} className="animate-spin" />}
          Save Quiz
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        {/* Settings bar */}
        <QuizSettingsBar
          quiz={quiz}
          onChange={handleQuizSettingsChange}
          onSave={handleSave}
          isSaving={isSaving}
        />

        {/* Mobile tab switcher */}
        <div className="lg:hidden flex border-b border-gray-200 bg-white rounded-t-xl">
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`flex-1 py-3 text-sm font-medium rounded-tl-xl transition-colors ${
              activeTab === 'questions'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Questions {quiz.questions.length > 0 && `(${quiz.questions.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex-1 py-3 text-sm font-medium rounded-tr-xl transition-colors ${
              activeTab === 'editor'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Editor
          </button>
        </div>

        {/* Two-panel layout */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left panel: question list */}
          <div
            className={`lg:w-72 flex-shrink-0 ${
              activeTab !== 'questions' ? 'hidden lg:block' : ''
            }`}
          >
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <QuestionListEditor
                questions={quiz.questions}
                selectedQuestionId={selectedQuestionId}
                onReorder={handleReorderQuestions}
                onSelectQuestion={handleSelectQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                onAddQuestion={handleAddQuestion}
              />
            </div>
          </div>

          {/* Right panel: editor */}
          <div
            className={`flex-1 min-w-0 ${
              activeTab !== 'editor' ? 'hidden lg:block' : ''
            }`}
          >
            {editingQuestion !== null ? (
              <QuestionEditorPanel
                question={editingQuestion}
                onSave={handleSaveQuestion}
                onCancel={handleCancelQuestion}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-200">
                <MessageSquare size={36} className="text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">
                  Select a question to edit
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  or add a new question.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
