import { CloudUpload } from 'lucide-react';
import { usePendingPhotoSync } from '../../hooks/usePendingPhotoSync';

interface PendingSyncBadgeProps {
  /** Scope the badge to a single work order; omit for a global badge. */
  woId?: string;
  className?: string;
}

/** Amber "pending sync" badge shown on records with unsynced changes. */
export function PendingSyncBadge({ woId, className = '' }: PendingSyncBadgeProps) {
  const { count } = usePendingPhotoSync(woId);
  if (count === 0) return null;

  return (
    <span
      title={`${count} item(s) waiting to sync`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 ring-1 ring-amber-200 ${className}`}
    >
      <CloudUpload className="w-3 h-3" />
      {count} pending
    </span>
  );
}
