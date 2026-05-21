import { AlertTriangle, Wrench, Package, Calendar, Bell } from 'lucide-react';
import { relativeTime } from '../../../utils/analytics.utils';
import type { DashboardNotification } from '../../../types/analytics.types';

const ICON_MAP = {
  breakdown: AlertTriangle,
  work_order: Wrench,
  parts: Package,
  pm: Calendar,
  alert: Bell,
};

const COLOR_MAP: Record<string, string> = {
  critical: 'text-[#EF4444]',
  high: 'text-[#F59E0B]',
  medium: 'text-[#EAB308]',
  low: 'text-[#10B981]',
};

interface NotificationFeedItemProps {
  notification: DashboardNotification;
}

export default function NotificationFeedItem({ notification }: NotificationFeedItemProps) {
  const Icon = ICON_MAP[notification.type] ?? Bell;
  const colorClass = COLOR_MAP[notification.severity] ?? 'text-[#8BA3BF]';

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-[#1E3A5F]/30 transition-colors cursor-pointer">
      <div className={`mt-0.5 ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#F0F4F8] leading-snug">{notification.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${colorClass.replace('text-', 'bg-')}`} />
          <span className="text-[11px] text-[#8BA3BF]">{relativeTime(notification.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}
