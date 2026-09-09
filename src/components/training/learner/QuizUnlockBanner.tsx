import { CheckCircle, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface QuizUnlockBannerProps {
  onStartQuiz: () => void;
  passingScore: number;
  attemptsRemaining?: number;
}

export default function QuizUnlockBanner({
  onStartQuiz,
  passingScore,
  attemptsRemaining,
}: QuizUnlockBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="mx-4 my-3 rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <CheckCircle size={18} className="text-blue-600 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm font-medium text-blue-800">
          {t('common.trainingShared.quizUnlockBanner.allLessonsComplete')}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-blue-700">
        <span>{t('common.trainingShared.quizUnlockBanner.passMark', { score: passingScore })}</span>
        {attemptsRemaining !== undefined && (
          <span>
            {attemptsRemaining > 0
              ? t('common.trainingShared.quizUnlockBanner.attemptsRemaining', { count: attemptsRemaining })
              : t('common.trainingShared.quizUnlockBanner.noAttemptsRemaining')}
          </span>
        )}
      </div>

      <button
        onClick={onStartQuiz}
        disabled={attemptsRemaining === 0}
        className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label={t('common.trainingShared.quizUnlockBanner.startQuizAria')}
      >
        {t('common.trainingShared.quizUnlockBanner.startQuiz')}
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
