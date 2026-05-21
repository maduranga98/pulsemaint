import { useState, useEffect } from 'react';
import { formatDurationSeconds } from '../../../utils/analytics.utils';

interface BreakdownElapsedTimerProps {
  startTime: Date;
  className?: string;
}

export default function BreakdownElapsedTimer({ startTime, className = '' }: BreakdownElapsedTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setElapsedSeconds(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className={`font-mono text-xs tabular-nums ${className}`}>
      {formatDurationSeconds(elapsedSeconds)}
    </span>
  );
}
