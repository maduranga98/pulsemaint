import { Loader2 } from 'lucide-react';
import type { TrainingQuiz } from '@/lib/training/trainingTypes';

interface QuizSettingsBarProps {
  quiz: Partial<TrainingQuiz>;
  onChange: (updates: Partial<TrainingQuiz>) => void;
  onSave: () => void;
  isSaving?: boolean;
}

interface TogglePillProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function TogglePill({ label, checked, onChange }: TogglePillProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transform transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-xs font-medium text-gray-600 whitespace-nowrap">{label}</span>
    </div>
  );
}

export default function QuizSettingsBar({
  quiz,
  onChange,
  onSave,
  isSaving = false,
}: QuizSettingsBarProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
        {/* Title */}
        <div className="flex-1 min-w-0 sm:min-w-[200px]">
          <label className="text-xs font-medium text-gray-500 block mb-1">Quiz Title</label>
          <input
            type="text"
            value={quiz.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Safety Assessment"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Numeric fields */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Pass Score</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={quiz.passingScore ?? 70}
                onChange={(e) => onChange({ passingScore: Number(e.target.value) })}
                className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-xs text-gray-500">%</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Time Limit</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={quiz.timeLimit ?? 0}
                onChange={(e) => onChange({ timeLimit: Number(e.target.value) })}
                className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-xs text-gray-500 whitespace-nowrap">min</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Max Attempts</label>
            <input
              type="number"
              min={0}
              value={quiz.maxAttempts ?? 0}
              onChange={(e) => onChange({ maxAttempts: Number(e.target.value) })}
              className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-4">
          <TogglePill
            label="Shuffle questions"
            checked={quiz.shuffleQuestions ?? false}
            onChange={(v) => onChange({ shuffleQuestions: v })}
          />
          <TogglePill
            label="Shuffle options"
            checked={quiz.shuffleOptions ?? false}
            onChange={(v) => onChange({ shuffleOptions: v })}
          />
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2 px-4 text-sm transition-colors whitespace-nowrap self-end sm:self-auto"
        >
          {isSaving && <Loader2 size={14} className="animate-spin" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}
