import { getHealthScoreColor, getHealthScoreLabel } from '../../lib/machineHealth';

interface MachineHealthScoreProps {
  score: number;
  variant?: 'bar' | 'gauge' | 'compact';
  showLabel?: boolean;
}

export function MachineHealthScore({
  score,
  variant = 'bar',
  showLabel = true,
}: MachineHealthScoreProps) {
  const color = getHealthScoreColor(score);
  const label = getHealthScoreLabel(score);

  if (variant === 'gauge') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - score / 100)}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color }}>
                {score}
              </div>
              {showLabel && <div className="text-xs text-gray-600">{label}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color }}>
          {score}
        </span>
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-xs">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${score}%`, backgroundColor: color }}
          />
        </div>
      </div>
    );
  }

  // Default bar variant
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Health Score</span>
        <span className="text-sm font-semibold" style={{ color }}>
          {score}/100
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300 rounded-full"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && <div className="text-xs text-gray-500">{label}</div>}
    </div>
  );
}
