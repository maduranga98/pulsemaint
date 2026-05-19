import { useEffect, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import type { WOStatus } from '../../types/workOrder';
import { SLA_STOPPED_STATUSES } from '../../constants/woConfig';

interface SLACountdownTimerProps {
  slaDeadline: Timestamp | null;
  status: WOStatus;
}

function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SLACountdownTimer({ slaDeadline, status }: SLACountdownTimerProps) {
  const [now, setNow] = useState(Date.now());

  const isStopped = SLA_STOPPED_STATUSES.includes(status);

  useEffect(() => {
    if (isStopped) return;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [isStopped]);

  if (!slaDeadline) return null;

  const deadlineMs = slaDeadline.toMillis();
  const diff = deadlineMs - now;

  if (isStopped) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
        SLA closed
      </span>
    );
  }

  const isOverdue = diff < 0;
  const isUrgent = diff < 2 * 3600000;   // < 2h
  const isWarning = diff < 24 * 3600000; // < 24h

  let colorClass = 'text-emerald-600';
  let dotClass = 'bg-emerald-500';
  if (isOverdue) {
    colorClass = 'text-red-700 font-semibold';
    dotClass = 'bg-red-600 animate-pulse';
  } else if (isUrgent) {
    colorClass = 'text-red-600 font-semibold';
    dotClass = 'bg-red-500';
  } else if (isWarning) {
    colorClass = 'text-amber-600';
    dotClass = 'bg-amber-500';
  }

  const label = isOverdue
    ? `Overdue by ${formatDuration(diff)}`
    : `Due in ${formatDuration(diff)}`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${colorClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
