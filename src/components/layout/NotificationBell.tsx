import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Wrench, Package, Calendar, GraduationCap, ClipboardCheck, FileText } from 'lucide-react';
import { useMyNotifications } from '@/hooks/useMyNotifications';
import { relativeTime } from '@/utils/analytics.utils';
import type { DashboardNotification, DashboardNotificationType } from '@/types/analytics.types';
import { useAuthStore } from '@/store/authStore';

const ICON_MAP: Record<DashboardNotificationType, typeof Bell> = {
  breakdown: AlertTriangle,
  work_order: Wrench,
  parts: Package,
  pm: Calendar,
  alert: Bell,
  training: GraduationCap,
  evaluation: ClipboardCheck,
  document: FileText,
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-500',
  high: 'text-amber-500',
  medium: 'text-yellow-500',
  low: 'text-emerald-500',
};

/** Global notification bell, mounted once in AppLayout's header — visible to every role. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const { notifications, unreadCount, markAsRead } = useMyNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!userProfile) return null;

  function handleItemClick(n: DashboardNotification) {
    void markAsRead(n.id);
    setOpen(false);
    if (n.linkTo) navigate(n.linkTo);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-slate-300 hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 z-50">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unreadCount > 0 && <span className="text-xs text-slate-400">{unreadCount} unread</span>}
          </div>
          {notifications.length === 0 ? (
            <p className="text-center py-10 text-sm text-slate-400">No notifications yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.slice(0, 30).map((n) => {
                const Icon = ICON_MAP[n.type] ?? Bell;
                const isUnread = !(n.readBy ?? []).includes(userProfile.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                      isUnread ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${SEVERITY_COLOR[n.severity] ?? 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${isUnread ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                        {n.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{relativeTime(n.timestamp)}</p>
                    </div>
                    {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
