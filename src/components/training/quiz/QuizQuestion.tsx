import type { QuizQuestion as QuizQuestionType, QuestionType } from '@/lib/training/trainingTypes';
import QuizOptionButton from './QuizOptionButton';
import { CheckCircle, XCircle } from 'lucide-react';

interface QuizQuestionProps {
  question: QuizQuestionType;
  questionNumber: number;
  selectedOptionIds: string[];
  onAnswer: (questionId: string, optionId: string) => void;
  isReadOnly?: boolean;
  showResult?: boolean;
}

export default function QuizQuestion({
  question,
  questionNumber,
  selectedOptionIds,
  onAnswer,
  isReadOnly = false,
  showResult = false,
}: QuizQuestionProps) {
  if (question.type === 'true_false') {
    return (
      <TrueFalseQuestion
        question={question}
        questionNumber={questionNumber}
        selectedOptionIds={selectedOptionIds}
        onAnswer={onAnswer}
        isReadOnly={isReadOnly}
        showResult={showResult}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
          Question {questionNumber}
        </span>
        <p className="text-lg font-medium text-slate-900 leading-snug">{question.text}</p>
        {question.imageUrl && (
          <img
            src={question.imageUrl}
            alt="Question illustration"
            className="w-full rounded-xl object-cover max-h-60"
          />
        )}
      </div>

      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = selectedOptionIds.includes(option.id);
          const showCorrect = showResult && option.isCorrect;
          const showWrong = showResult && isSelected && !option.isCorrect;

          return (
            <div key={option.id}>
              {showResult ? (
                <div
                  className={[
                    'flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 min-h-[52px]',
                    showCorrect
                      ? 'border-green-500 bg-green-50 text-green-900'
                      : showWrong
                      ? 'border-red-400 bg-red-50 text-red-900'
                      : isSelected
                      ? 'border-slate-300 bg-slate-50 text-slate-700'
                      : 'border-slate-200 bg-white text-slate-600',
                  ].join(' ')}
                >
                  <span className="shrink-0">
                    {showCorrect ? (
                      <CheckCircle size={20} className="text-green-600" />
                    ) : showWrong ? (
                      <XCircle size={20} className="text-red-500" />
                    ) : (
                      <span className="w-5 h-5 block" />
                    )}
                  </span>
                  <span className="text-base">{option.text}</span>
                </div>
              ) : (
                <QuizOptionButton
                  option={option}
                  isSelected={isSelected}
                  isDisabled={isReadOnly}
                  questionType={question.type}
                  onClick={() => onAnswer(question.id, option.id)}
                />
              )}
              {showResult && (isSelected || option.isCorrect) && option.explanation && (
                <p className="text-sm text-slate-600 mt-1 ml-4 italic">{option.explanation}</p>
              )}
            </div>
          );
        })}
      </div>

      {showResult && question.explanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          <strong>Explanation:</strong> {question.explanation}
        </div>
      )}
    </div>
  );
}

function TrueFalseQuestion({
  question,
  questionNumber,
  selectedOptionIds,
  onAnswer,
  isReadOnly,
  showResult,
}: Omit<QuizQuestionProps, 'questionType'>) {
  const trueOption = question.options.find((o) => o.text.toLowerCase() === 'true');
  const falseOption = question.options.find((o) => o.text.toLowerCase() === 'false');

  if (!trueOption || !falseOption) {
    return <div className="text-red-500 text-sm">Invalid true/false question.</div>;
  }

  const getButtonClass = (option: typeof trueOption) => {
    if (!option) return '';
    const isSelected = selectedOptionIds.includes(option.id);
    if (showResult) {
      if (option.isCorrect) return 'border-green-500 bg-green-50 text-green-800';
      if (isSelected && !option.isCorrect) return 'border-red-400 bg-red-50 text-red-800';
      return 'border-slate-200 bg-white text-slate-500';
    }
    return isSelected
      ? 'border-blue-600 bg-blue-50 text-blue-900'
      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300';
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
          Question {questionNumber}
        </span>
        <p className="text-lg font-medium text-slate-900 leading-snug">{question.text}</p>
        {question.imageUrl && (
          <img src={question.imageUrl} alt="Question" className="w-full rounded-xl object-cover max-h-60" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[trueOption, falseOption].map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={isReadOnly}
            onClick={() => onAnswer(question.id, option.id)}
            className={`py-4 rounded-xl border-2 font-semibold text-lg transition-all min-h-[64px] ${getButtonClass(option)}`}
            aria-pressed={selectedOptionIds.includes(option.id)}
          >
            {option.text.toUpperCase()}
          </button>
        ))}
      </div>
      {showResult && question.explanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          <strong>Explanation:</strong> {question.explanation}
        </div>
      )}
    </div>
  );
}
