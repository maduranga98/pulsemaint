import type { QuizOption, QuestionType } from '@/lib/training/trainingTypes';
import { CheckSquare, Square, Circle, CheckCircle2 } from 'lucide-react';

interface QuizOptionButtonProps {
  option: QuizOption;
  isSelected: boolean;
  isDisabled?: boolean;
  questionType: QuestionType;
  onClick: () => void;
}

export default function QuizOptionButton({
  option,
  isSelected,
  isDisabled = false,
  questionType,
  onClick,
}: QuizOptionButtonProps) {
  const isMultiple = questionType === 'multiple_choice';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-pressed={isSelected}
      className={[
        'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all min-h-[52px]',
        isSelected
          ? 'border-blue-600 bg-blue-50 text-blue-900'
          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50',
        isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="shrink-0 text-current">
        {isMultiple ? (
          isSelected ? (
            <CheckSquare size={20} className="text-blue-600" />
          ) : (
            <Square size={20} className="text-slate-400" />
          )
        ) : isSelected ? (
          <CheckCircle2 size={20} className="text-blue-600" />
        ) : (
          <Circle size={20} className="text-slate-400" />
        )}
      </span>
      <span className="text-base leading-snug">{option.text}</span>
    </button>
  );
}
