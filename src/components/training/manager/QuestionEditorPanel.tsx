import { useState } from 'react';
import { nanoid } from 'nanoid';
import type { QuizQuestion, QuestionType, QuizOption } from '@/lib/training/trainingTypes';
import QuestionOptionBuilder from './QuestionOptionBuilder';

interface QuestionEditorPanelProps {
  question?: Partial<QuizQuestion>;
  onSave: (q: QuizQuestion) => void;
  onCancel: () => void;
}

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: 'single_choice', label: 'Single Choice', description: 'One correct answer' },
  { value: 'multiple_choice', label: 'Multiple Choice', description: 'Multiple correct answers' },
  { value: 'true_false', label: 'True / False', description: 'True or false' },
];

function buildDefaultOptions(type: QuestionType): QuizOption[] {
  if (type === 'true_false') {
    return [
      { id: nanoid(), text: 'True', isCorrect: true, explanation: '' },
      { id: nanoid(), text: 'False', isCorrect: false, explanation: '' },
    ];
  }
  return [
    { id: nanoid(), text: '', isCorrect: true, explanation: '' },
    { id: nanoid(), text: '', isCorrect: false, explanation: '' },
  ];
}

export default function QuestionEditorPanel({
  question,
  onSave,
  onCancel,
}: QuestionEditorPanelProps) {
  const [text, setText] = useState(question?.text ?? '');
  const [type, setType] = useState<QuestionType>(question?.type ?? 'single_choice');
  const [imageUrl, setImageUrl] = useState(question?.imageUrl ?? '');
  const [points, setPoints] = useState(question?.points ?? 1);
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [options, setOptions] = useState<QuizOption[]>(
    question?.options && question.options.length > 0
      ? question.options
      : buildDefaultOptions(question?.type ?? 'single_choice')
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleTypeChange(newType: QuestionType) {
    setType(newType);
    setOptions(buildDefaultOptions(newType));
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!text.trim()) {
      nextErrors.text = 'Question text is required.';
    }
    const hasCorrect = options.some((o) => o.isCorrect);
    if (!hasCorrect) {
      nextErrors.options = 'At least one correct answer is required.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    const saved: QuizQuestion = {
      id: question?.id ?? nanoid(),
      order: question?.order ?? 0,
      text: text.trim(),
      type,
      imageUrl,
      options,
      points: Math.max(1, Number(points)),
      explanation,
    };

    onSave(saved);
  }

  return (
    <div className="flex flex-col gap-5 p-5 bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">
          {question?.id ? 'Edit Question' : 'New Question'}
        </h3>
      </div>

      {/* Question Text */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Question Text <span className="text-red-500">*</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); if (errors.text) setErrors((p) => ({ ...p, text: '' })); }}
          rows={3}
          placeholder="Enter the question…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        {errors.text && <p className="text-xs text-red-500">{errors.text}</p>}
      </div>

      {/* Question Type */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Question Type</label>
        <div className="flex flex-col sm:flex-row gap-2">
          {QUESTION_TYPES.map((qt) => (
            <label
              key={qt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors flex-1 ${
                type === qt.value
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="question-type"
                value={qt.value}
                checked={type === qt.value}
                onChange={() => handleTypeChange(qt.value)}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{qt.label}</p>
                <p className="text-xs text-gray-400">{qt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Image URL (optional) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Image URL <span className="text-gray-400 font-normal">(optional)</span></label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Points */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Points</label>
        <input
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Options */}
      <div className="flex flex-col gap-1">
        {errors.options && <p className="text-xs text-red-500 mb-1">{errors.options}</p>}
        <QuestionOptionBuilder
          options={options}
          questionType={type}
          onChange={(updated) => {
            setOptions(updated);
            if (errors.options) setErrors((p) => ({ ...p, options: '' }));
          }}
        />
      </div>

      {/* Explanation */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Explanation <span className="text-gray-400 font-normal">(shown after submission)</span>
        </label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={2}
          placeholder="Explain the correct answer…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2 px-5 text-sm transition-colors"
        >
          Save Question
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
