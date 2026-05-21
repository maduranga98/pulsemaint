import { useState, useEffect } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

interface SlaCountdownBadgeProps {
  deadline: Date | null;
}

export default function SlaCountdownBadge({ deadline }: SlaCountdownBadgeProps) {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const diff = Math.ceil((deadline.getTime() - Date.now()) / 60000);
      setMinutesLeft(diff);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline || minutesLeft === null) return null;

  const isBreached = minutesLeft < 0;
  const isAtRisk = minutesLeft >= 0 && minutesLeft <= 60;

  if (isBreached) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#EF4444]/20 text-[#EF4444]">
        <AlertTriangle className="w-3 h-3" />
        Breached {Math.abs(minutesLeft)}m ago
      </span>
    );
  }

  if (isAtRisk) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#F59E0B]/20 text-[#F59E0B]">
        <Clock className="w-3 h-3" />
        {minutesLeft}m left
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#10B981]/20 text-[#10B981]">
      <Clock className="w-3 h-3" />
      {Math.floor(minutesLeft / 60)}h left
    </span>
  );
}
