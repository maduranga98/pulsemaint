import { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';

interface QuizTimerProps {
  totalSeconds: number;
  onExpire: () => void;
  className?: string;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export default function QuizTimer({ totalSeconds, onExpire, className = '' }: QuizTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expire = useCallback(onExpire, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (remaining <= 0) {
      expire();
      return;
    }
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          expire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []); // run once on mount

  const colorClass =
    remaining < 30
      ? 'text-red-600'
      : remaining < 120
      ? 'text-amber-600'
      : 'text-slate-700';

  return (
    <div
      className={`inline-flex items-center gap-1 font-mono font-semibold text-sm ${colorClass} ${className}`}
      aria-label={`Time remaining: ${formatTime(remaining)}`}
      role="timer"
    >
      <Clock size={14} />
      {formatTime(remaining)}
    </div>
  );
}
