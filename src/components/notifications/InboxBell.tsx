import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AtSign, CheckCheck } from 'lucide-react';
import { useInbox } from '../../hooks/useInbox';
import type { UserNotification } from '../../types/comments';

function timeAgo(ts: any): string {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function InboxBell() {
  const navigate = useNavigate();
  const { items, unreadCount, markRead, markAllRead } = useInbox();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleClick(n: UserNotification) {
    if (!n.read) void markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-[#142849] text-[#8BA3BF] hover:text-[#F0F4F8] transition-colors"
        aria-label="Inbox"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Inbox</span>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No notifications.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 border-b border-gray-50 hover:bg-gray-50 ${
                    n.read ? '' : 'bg-blue-50/40'
                  }`}
                >
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 truncate">{n.body}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              navigate('/app/settings/notifications');
            }}
            className="w-full text-center px-4 py-2.5 border-t border-gray-100 text-xs font-medium text-blue-600 hover:bg-gray-50"
          >
            Notification settings
          </button>
        </div>
      )}
    </div>
  );
}
