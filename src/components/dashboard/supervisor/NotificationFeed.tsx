import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../../hooks/dashboard/useNotifications';
import DashboardWidget from '../shared/DashboardWidget';
import NotificationFeedItem from './NotificationFeedItem';
import EmptyState from '../shared/EmptyState';
import type { DashboardNotificationType } from '../../../types/analytics.types';

const FILTERS: { label: string; value: DashboardNotificationType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Breakdowns', value: 'breakdown' },
  { label: 'Work Orders', value: 'work_order' },
  { label: 'Parts', value: 'parts' },
  { label: 'PM', value: 'pm' },
  { label: 'Alerts', value: 'alert' },
];

interface NotificationFeedProps {
  companyId: string;
}

export default function NotificationFeed({ companyId }: NotificationFeedProps) {
  const [filter, setFilter] = useState<DashboardNotificationType | 'all'>('all');
  const { notifications, loading, error } = useNotifications(companyId);

  const filtered =
    filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);

  return (
    <DashboardWidget
      title="Notifications"
      live
      loading={loading}
      error={error}
      action={
        <div className="flex items-center gap-1">
          <Bell className="w-3.5 h-3.5 text-[#8BA3BF]" />
          <span className="text-xs text-[#8BA3BF]">{notifications.length}</span>
        </div>
      }
    >
      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
              filter === f.value
                ? 'bg-[#1A56DB] text-white'
                : 'bg-[#0A1628] text-[#8BA3BF] hover:text-[#F0F4F8]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="max-h-[420px] overflow-y-auto -mx-5">
        {filtered.length === 0 ? (
          <EmptyState message="No notifications" subMessage="All caught up!" />
        ) : (
          <div className="divide-y divide-[#1E3A5F]/50">
            {filtered.map((n) => (
              <NotificationFeedItem key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>
    </DashboardWidget>
  );
}
