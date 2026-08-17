import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle } from 'lucide-react';
import type { QuizQuestion, QuizAnswer } from '@/lib/training/trainingTypes';

interface QuizAnswerReviewProps {
  questions: QuizQuestion[];
  answers: QuizAnswer[];
}

export default function QuizAnswerReview({ questions, answers }: QuizAnswerReviewProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h3 className="font-bold text-slate-900 text-lg">{t('common.training.quizAnswerReview.title')}</h3>
      {questions.map((q, i) => {
        const answer = answers.find((a) => a.questionId === q.id);
        const isCorrect = answer?.isCorrect ?? false;
        const selectedIds = answer?.selectedOptionIds ?? [];
        const correctOptions = q.options.filter((o) => o.isCorrect);

        return (
          <div key={q.id} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Question header */}
            <div
              className={`flex items-center gap-2 px-4 py-3 ${
                isCorrect ? 'bg-green-50 border-b border-green-100' : 'bg-red-50 border-b border-red-100'
              }`}
            >
              {isCorrect ? (
                <CheckCircle size={18} className="text-green-600 shrink-0" />
              ) : (
                <XCircle size={18} className="text-red-500 shrink-0" />
              )}
              <span className="text-sm font-semibold text-slate-700">
                {t('common.training.quizAnswerReview.questionLabel', {
                  number: i + 1,
                  result: isCorrect ? t('common.training.quizAnswerReview.correct') : t('common.training.quizAnswerReview.incorrect'),
                })}
              </span>
              <span className="ml-auto text-xs text-slate-500 font-mono">
                {t('common.training.quizAnswerReview.pointsFraction', { earned: answer?.pointsEarned ?? 0, total: q.points })}
              </span>
            </div>

            <div className="px-4 py-3 space-y-3">
              <p className="text-sm text-slate-800">{q.text}</p>

              {/* User's answer */}
              <div>
                <p className="text-xs text-slate-500 mb-1">{t('common.training.quizAnswerReview.yourAnswer')}</p>
                {selectedIds.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">{t('common.training.quizAnswerReview.noAnswerSelected')}</span>
                ) : (
                  selectedIds.map((id) => {
                    const opt = q.options.find((o) => o.id === id);
                    return (
                      <span
                        key={id}
                        className={`inline-block text-sm px-2 py-0.5 rounded mr-1 mb-1 ${
                          opt?.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {opt?.text ?? id}
                      </span>
                    );
                  })
                )}
              </div>

              {/* Correct answer */}
              {!isCorrect && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">{t('common.training.quizAnswerReview.correctAnswer')}</p>
                  {correctOptions.map((opt) => (
                    <span
                      key={opt.id}
                      className="inline-block text-sm px-2 py-0.5 rounded mr-1 bg-green-100 text-green-800"
                    >
                      {opt.text}
                    </span>
                  ))}
                </div>
              )}

              {/* Explanation */}
              {q.explanation && (
                <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 italic">
                  {q.explanation}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
