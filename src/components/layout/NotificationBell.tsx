import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Wrench, Package, Calendar, GraduationCap, ClipboardCheck, FileText, CheckCheck } from 'lucide-react';
import { useMyNotifications } from '@/hooks/useMyNotifications';
import { useDerivedAlerts } from '@/hooks/useDerivedAlerts';
import { relativeTime } from '@/utils/analytics.utils';
import type { DashboardNotification, DashboardNotificationType } from '@/types/analytics.types';
import { useAuthStore } from '@/store/authStore';
import { notificationDisplayMessage } from '@/lib/notifications/recipients';

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
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useMyNotifications();
  const derivedAlerts = useDerivedAlerts();
  // Session-dismissed derived alerts (they re-appear next session if still
  // unresolved — they're state-derived, so they clear on their own once fixed).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const alerts = derivedAlerts.filter((a) => !dismissed.has(a.id));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const totalCount = unreadCount + alerts.length;

  // Clear everything currently in the bell: mark all persisted notifications
  // read and dismiss all state-derived alerts for this session.
  function handleReadAll() {
    if (unreadCount > 0) void markAllAsRead();
    if (alerts.length > 0) {
      setDismissed((prev) => {
        const next = new Set(prev);
        for (const a of alerts) next.add(a.id);
        return next;
      });
    }
  }

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
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 z-50">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {totalCount > 0 && (
              <button
                type="button"
                onClick={handleReadAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>
          {/* State-derived alerts: expiring/due items and stock/PO alerts,
              shown to the roles that own them. They clear automatically once
              the underlying condition is resolved. */}
          {alerts.length > 0 && (
            <div className="divide-y divide-amber-100 bg-amber-50/40">
              <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Needs attention
              </p>
              {alerts.slice(0, 30).map((a) => {
                const Icon = ICON_MAP[a.type] ?? Bell;
                return (
                  <div key={a.id} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-amber-50 transition-colors">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${SEVERITY_COLOR[a.severity] ?? 'text-slate-400'}`} />
                    <button
                      onClick={() => {
                        setOpen(false);
                        if (a.linkTo) navigate(a.linkTo);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm leading-snug text-slate-900 font-medium">{a.message}</p>
                    </button>
                    <button
                      onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
                      className="text-slate-300 hover:text-slate-500 text-xs shrink-0"
                      aria-label="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {notifications.length === 0 && alerts.length === 0 ? (
            <p className="text-center py-10 text-sm text-slate-400">You&rsquo;re all caught up.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Everything listed is unread by definition — opening a
                  notification marks it read, which removes it from the bar. */}
              {notifications.slice(0, 30).map((n) => {
                const Icon = ICON_MAP[n.type] ?? Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left bg-blue-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${SEVERITY_COLOR[n.severity] ?? 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug text-slate-900 font-medium">
                        {notificationDisplayMessage(n, userProfile.role, userProfile.id)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{relativeTime(n.timestamp)}</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
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
