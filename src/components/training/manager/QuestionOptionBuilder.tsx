import { nanoid } from 'nanoid';
import { Plus, X } from 'lucide-react';
import type { QuizOption, QuestionType } from '@/lib/training/trainingTypes';

interface QuestionOptionBuilderProps {
  options: QuizOption[];
  questionType: QuestionType;
  onChange: (options: QuizOption[]) => void;
}

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

export default function QuestionOptionBuilder({
  options,
  questionType,
  onChange,
}: QuestionOptionBuilderProps) {
  const hasCorrect = options.some((o) => o.isCorrect);

  function handleTextChange(id: string, text: string) {
    onChange(options.map((o) => (o.id === id ? { ...o, text } : o)));
  }

  function handleExplanationChange(id: string, explanation: string) {
    onChange(options.map((o) => (o.id === id ? { ...o, explanation } : o)));
  }

  function handleCorrectChange(id: string, checked: boolean) {
    if (questionType === 'single_choice' || questionType === 'true_false') {
      // Only one correct answer allowed
      onChange(options.map((o) => ({ ...o, isCorrect: o.id === id ? checked : false })));
    } else {
      // multiple_choice: toggle individual
      onChange(options.map((o) => (o.id === id ? { ...o, isCorrect: checked } : o)));
    }
  }

  function handleAddOption() {
    if (options.length >= MAX_OPTIONS) return;
    const newOption: QuizOption = {
      id: nanoid(),
      text: '',
      isCorrect: false,
      explanation: '',
    };
    onChange([...options, newOption]);
  }

  function handleRemoveOption(id: string) {
    if (options.length <= MIN_OPTIONS) return;
    onChange(options.filter((o) => o.id !== id));
  }

  // ── True/False fixed layout ─────────────────────────────────────────────
  if (questionType === 'true_false') {
    const trueOpt = options[0];
    const falseOpt = options[1];

    return (
      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-gray-700">Answer Options</label>
        {[trueOpt, falseOpt].filter(Boolean).map((opt, idx) => {
          const label = idx === 0 ? 'TRUE' : 'FALSE';
          return (
            <div key={opt.id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50">
                <input
                  type="radio"
                  name="true-false-correct"
                  checked={opt.isCorrect}
                  onChange={() => handleCorrectChange(opt.id, true)}
                  className="w-4 h-4 accent-blue-600 flex-shrink-0"
                />
                <span
                  className={`text-sm font-semibold flex-1 ${
                    idx === 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {label}
                </span>
                {opt.isCorrect && (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    Correct
                  </span>
                )}
              </div>
              <input
                type="text"
                value={opt.explanation}
                onChange={(e) => handleExplanationChange(opt.id, e.target.value)}
                placeholder={`Explanation for ${label}…`}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          );
        })}
        {!hasCorrect && (
          <p className="text-xs text-red-500">Please select the correct answer.</p>
        )}
      </div>
    );
  }

  // ── Single / Multiple choice ────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Answer Options</label>
        <span className="text-xs text-gray-400">{options.length}/{MAX_OPTIONS} options</span>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((opt, idx) => (
          <div key={opt.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {/* Correct indicator */}
              {questionType === 'single_choice' ? (
                <input
                  type="radio"
                  name="correct-answer"
                  checked={opt.isCorrect}
                  onChange={() => handleCorrectChange(opt.id, true)}
                  title="Mark as correct answer"
                  className="w-4 h-4 accent-blue-600 flex-shrink-0 cursor-pointer"
                />
              ) : (
                <input
                  type="checkbox"
                  checked={opt.isCorrect}
                  onChange={(e) => handleCorrectChange(opt.id, e.target.checked)}
                  title="Mark as correct answer"
                  className="w-4 h-4 accent-blue-600 flex-shrink-0 cursor-pointer"
                />
              )}

              {/* Option text */}
              <input
                type="text"
                value={opt.text}
                onChange={(e) => handleTextChange(opt.id, e.target.value)}
                placeholder={`Option ${idx + 1}`}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemoveOption(opt.id)}
                disabled={options.length <= MIN_OPTIONS}
                className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                aria-label="Remove option"
              >
                <X size={15} />
              </button>
            </div>

            {/* Explanation */}
            <div className="ml-6">
              <input
                type="text"
                value={opt.explanation}
                onChange={(e) => handleExplanationChange(opt.id, e.target.value)}
                placeholder="Explanation (shown after answer)…"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        ))}
      </div>

      {!hasCorrect && options.length >= MIN_OPTIONS && (
        <p className="text-xs text-red-500">Please mark at least one correct answer.</p>
      )}

      {options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={handleAddOption}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg py-2 px-3 transition-colors"
        >
          <Plus size={14} />
          Add Option
        </button>
      )}
    </div>
  );
}
