import { useState } from 'react';
import { CheckCircle, AlertCircle, ChevronLeft } from 'lucide-react';
import type { QuizQuestion } from '@/lib/training/trainingTypes';

interface QuizReviewScreenProps {
  questions: QuizQuestion[];
  answers: Record<string, string[]>;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export default function QuizReviewScreen({
  questions,
  answers,
  onSubmit,
  onBack,
  isSubmitting,
}: QuizReviewScreenProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const answered = questions.filter((q) => (answers[q.id] ?? []).length > 0);
  const unanswered = questions.filter((q) => (answers[q.id] ?? []).length === 0);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Review Your Answers</h2>
        <p className="text-slate-500 text-sm mt-1">
          {answered.length} of {questions.length} questions answered
        </p>
      </div>

      {unanswered.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 text-amber-800 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{unanswered.length} question{unanswered.length > 1 ? 's' : ''} not answered.</span>
        </div>
      )}

      {/* Question list */}
      <div className="space-y-2">
        {questions.map((q, i) => {
          const isAnswered = (answers[q.id] ?? []).length > 0;
          return (
            <div
              key={q.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                isAnswered ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              {isAnswered ? (
                <CheckCircle size={18} className="text-green-600 shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-amber-500 shrink-0" />
              )}
              <span className="text-sm text-slate-700 line-clamp-1">
                Q{i + 1}: {q.text}
              </span>
              <span className={`ml-auto text-xs font-medium shrink-0 ${isAnswered ? 'text-green-600' : 'text-amber-600'}`}>
                {isAnswered ? 'Answered' : 'Skipped'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft size={18} /> Back
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
        >
          Submit Quiz
        </button>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg">Submit quiz?</h3>
            <p className="text-slate-600 text-sm">
              You cannot change your answers after submission.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); onSubmit(); }}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
