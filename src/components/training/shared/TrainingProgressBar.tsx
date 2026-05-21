interface TrainingProgressBarProps {
  progress: number;
  className?: string;
  showLabel?: boolean;
}

export default function TrainingProgressBar({
  progress,
  className = '',
  showLabel = false,
}: TrainingProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const isComplete = clamped === 100;
  const fillColor = isComplete ? 'bg-green-500' : 'bg-blue-600';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${clamped}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-slate-600 shrink-0 w-8 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
}
