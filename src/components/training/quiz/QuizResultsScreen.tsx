import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ArrowRight, RotateCcw, User } from 'lucide-react';
import type { QuizAttemptResult } from '@/lib/training/trainingTypes';

interface QuizResultsScreenProps {
  result: QuizAttemptResult;
  passingScore: number;
  attemptsRemaining: number;
  maxAttempts: number;
  cooldownSeconds: number;
  onRetry?: () => void;
  onContinue: () => void;
  moduleName: string;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function QuizResultsScreen({
  result,
  passingScore,
  attemptsRemaining,
  maxAttempts,
  cooldownSeconds,
  onRetry,
  onContinue,
  moduleName,
}: QuizResultsScreenProps) {
  const [countdown, setCountdown] = useState(cooldownSeconds);
  const passed = result.passed;

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [countdown]);

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Score hero */}
      <div
        className={`rounded-2xl px-6 py-8 text-center space-y-3 ${
          passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}
      >
        <div className="flex justify-center">
          {passed ? (
            <CheckCircle size={56} className="text-green-500" />
          ) : (
            <XCircle size={56} className="text-red-500" />
          )}
        </div>
        <p className={`text-6xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
          {result.score}%
        </p>
        <p className={`text-lg font-semibold ${passed ? 'text-green-800' : 'text-red-800'}`}>
          {passed ? '✓ Congratulations! You passed.' : `✗ You did not pass. Score needed: ${passingScore}%.`}
        </p>
        <p className="text-sm text-slate-600">{moduleName}</p>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Correct', value: `${result.correctAnswers}/${result.totalQuestions}` },
          { label: 'Score', value: `${result.score}%` },
          { label: 'Time', value: formatTime(result.timeTakenSeconds) },
        ].map((item) => (
          <div key={item.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
            <p className="text-lg font-bold text-slate-900">{item.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      {passed ? (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-blue-800">
            <User size={16} />
            Your supervisor will observe and sign off your practical skills.
          </div>
          <button
            onClick={onContinue}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl transition-colors"
          >
            Continue <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {attemptsRemaining > 0 || maxAttempts === 0 ? (
            countdown > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center text-sm text-amber-800">
                Retry available in{' '}
                <span className="font-mono font-semibold">{formatTime(countdown)}</span>
              </div>
            ) : (
              <button
                onClick={onRetry}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors"
              >
                <RotateCcw size={18} /> Retry Quiz
              </button>
            )
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 text-center">
              You have used all quiz attempts. Contact your supervisor.
            </div>
          )}
          {(attemptsRemaining > 0 || maxAttempts === 0) && (
            <p className="text-sm text-slate-500 text-center">
              {maxAttempts === 0
                ? 'Unlimited attempts'
                : `${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining`}
            </p>
          )}
          <button
            onClick={onContinue}
            className="w-full py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm transition-colors"
          >
            Back to Module
          </button>
        </div>
      )}
    </div>
  );
}
