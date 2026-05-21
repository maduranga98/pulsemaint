import { FileText, Clock, Target, RotateCcw, BookOpen } from 'lucide-react';
import type { TrainingQuiz } from '@/lib/training/trainingTypes';

interface QuizPreScreenProps {
  quiz: TrainingQuiz;
  moduleName: string;
  machineName: string;
  attemptsUsed: number;
  onStart: () => void;
}

export default function QuizPreScreen({
  quiz,
  moduleName,
  machineName,
  attemptsUsed,
  onStart,
}: QuizPreScreenProps) {
  const attemptsRemaining =
    quiz.maxAttempts === 0 ? null : quiz.maxAttempts - attemptsUsed;

  const infoCards = [
    {
      icon: <FileText size={20} className="text-blue-600" />,
      label: `${quiz.questions.length} questions`,
    },
    {
      icon: <Clock size={20} className="text-blue-600" />,
      label: quiz.timeLimit > 0 ? `${quiz.timeLimit} minutes` : 'No time limit',
    },
    {
      icon: <Target size={20} className="text-blue-600" />,
      label: `Pass mark: ${quiz.passingScore}%`,
    },
    {
      icon: <RotateCcw size={20} className="text-blue-600" />,
      label:
        attemptsRemaining === null
          ? 'Unlimited attempts'
          : attemptsRemaining === 0
          ? 'No attempts remaining'
          : `${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining`,
    },
  ];

  const canStart = attemptsRemaining === null || attemptsRemaining > 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
            <BookOpen size={28} className="text-blue-600" />
          </div>
        </div>
        <p className="text-sm text-slate-500">{machineName}</p>
        <h1 className="text-xl font-bold text-slate-900">{moduleName}</h1>
        <h2 className="text-lg font-semibold text-slate-700">{quiz.title}</h2>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3">
        {infoCards.map((card, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100"
          >
            {card.icon}
            <span className="text-sm text-slate-700 font-medium">{card.label}</span>
          </div>
        ))}
      </div>

      {/* Instructions */}
      {quiz.instructions && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold mb-1">Instructions</p>
          <p>{quiz.instructions}</p>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onStart}
        disabled={!canStart}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
          canStart
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
        }`}
        aria-label="Start quiz"
      >
        {canStart ? 'Start Quiz' : 'No Attempts Remaining'}
      </button>
    </div>
  );
}
