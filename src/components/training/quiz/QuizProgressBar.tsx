interface QuizProgressBarProps {
  current: number;
  total: number;
  answeredCount: number;
}

export default function QuizProgressBar({ current, total, answeredCount }: QuizProgressBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-slate-700 shrink-0">
        Q {current} of {total}
      </span>
      <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${total > 0 ? (answeredCount / total) * 100 : 0}%` }}
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
      <span className="text-xs text-slate-500 shrink-0">{answeredCount}/{total}</span>
    </div>
  );
}
