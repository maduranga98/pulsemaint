import { AlertTriangle } from 'lucide-react';

interface RetrainingBadgeProps {
  reason?: string;
}

export default function RetrainingBadge({ reason }: RetrainingBadgeProps) {
  return (
    <div className="mt-1">
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 animate-pulse"
        aria-label="Retraining required"
      >
        <AlertTriangle size={11} aria-hidden="true" />
        Retraining Required
      </span>
      {reason && (
        <p className="mt-1 text-xs text-red-600 leading-snug">{reason}</p>
      )}
    </div>
  );
}
