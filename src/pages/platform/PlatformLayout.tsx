import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Building2, ClipboardList, CreditCard, Gauge, LogOut, ArrowLeft, BellRing, Contact, PhoneCall, Wallet, Lightbulb, ListTodo, UserX, Layers, UserCog } from 'lucide-react';
import { useSuperadmin } from '@/lib/platform/useSuperadmin';
import { usePlatformUnread } from '@/lib/platform/usePlatformUnread';
import { usePaymentAlerts } from '@/lib/platform/usePaymentAlerts';
import { useCallsDue } from '@/lib/platform/useCallsDue';
import { usePendingRegistrations } from '@/lib/platform/usePendingRegistrations';
import { useNewLeads, useOpenCancellations, useTodosDue, useUnseenFeatureRequests } from '@/lib/platform/useNavBadges';
import { getNotificationPermission, isDeviceNotificationSupported, requestDeviceNotificationPermission } from '@/lib/notifications/deviceNotify';
import { logout } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
import AuthLoading from '@/components/auth/AuthLoading';
import SuperadminActivatePage from './SuperadminActivatePage';
import PlatformBell from './PlatformBell';

type NavLinkItem = { to: string; label: string; icon: typeof Gauge; end?: boolean };
type NavItem = NavLinkItem | { section: string };

const NAV: readonly NavItem[] = [
  { to: '/platform', label: 'Overview', icon: Gauge, end: true },
  { to: '/platform/companies', label: 'Companies', icon: Building2 },
  { to: '/platform/payments', label: 'Payments', icon: CreditCard },
  { to: '/platform/plans', label: 'Plans', icon: Layers },
  { to: '/platform/expenses', label: 'Expenses', icon: Wallet },
  { to: '/platform/requests', label: 'Requests & feedback', icon: ClipboardList },
  { to: '/platform/cancellations', label: 'Cancellations', icon: UserX },
  { section: 'Sales' },
  { to: '/platform/leads', label: 'Leads', icon: Contact },
  { to: '/platform/calls', label: 'Calls', icon: PhoneCall },
  { to: '/platform/feature-requests', label: 'Feature requests', icon: Lightbulb },
  { to: '/platform/todos', label: 'To-Do', icon: ListTodo },
  { to: '/platform/sales-managers', label: 'Sales managers', icon: UserCog },
];

/** The only console pages a sales manager (no superadmin claim) may open. */
const SALES_PATHS = ['/platform/leads', '/platform/calls', '/platform/feature-requests', '/platform/todos', '/platform/plans'];

const BADGE_TITLE: Record<string, string> = {
  '/platform/payments': 'New payment alerts',
  '/platform/requests': 'Unread requests & feedback',
  '/platform/cancellations': 'Open cancellations / leave requests',
  '/platform/leads': 'New leads not called yet + trial requests waiting for approval',
  '/platform/calls': 'Calls due today or overdue',
  '/platform/feature-requests': 'New feature requests / bugs since you last looked',
  '/platform/todos': 'To-dos due today or overdue',
};

function NavBadge({ count, title }: { count: number; title?: string }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto min-w-[18px] rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-[18px] text-white" title={title} aria-label={`${count} ${title ?? 'new'}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Lumora Ventures platform console. Separate from the tenant app shell: it
 * is not tied to one company, and company suspension never applies here.
 * Signed-in accounts without the superadmin claim see the activation page.
 */
export default function PlatformLayout() {
  const { ready, signedIn, isSuperadmin, isSalesManager, email } = useSuperadmin();
  const salesOnly = isSalesManager && !isSuperadmin;
  const salesAccess = isSuperadmin || isSalesManager;
  const hasCompany = useAuthStore((s) => !!s.userProfile);
  const location = useLocation();
  const unread = usePlatformUnread(ready && isSuperadmin);
  const paymentAlerts = usePaymentAlerts(ready && isSuperadmin);
  const callsDue = useCallsDue(ready && salesAccess);
  const pendingRegistrations = usePendingRegistrations(ready && salesAccess);
  const todosDue = useTodosDue(ready && salesAccess);
  const newLeads = useNewLeads(ready && salesAccess);
  const unseenFeatures = useUnseenFeatureRequests(ready && salesAccess);
  const openCancellations = useOpenCancellations(ready && isSuperadmin);
  const [permission, setPermission] = useState(() => getNotificationPermission());

  // Red unread / needs-attention counts per tab.
  const badges: Record<string, number> = {
    '/platform/payments': paymentAlerts.length,
    '/platform/requests': unread.length,
    '/platform/cancellations': openCancellations,
    '/platform/leads': newLeads + pendingRegistrations.length,
    '/platform/calls': callsDue,
    '/platform/feature-requests': unseenFeatures,
    '/platform/todos': todosDue,
  };

  if (!ready) return <AuthLoading />;
  if (!signedIn) return <Navigate to="/platform/login" replace state={{ from: location.pathname }} />;
  if (!salesAccess) return <SuperadminActivatePage />;
  // Sales managers: only the sales tabs; anything else goes to Leads.
  if (salesOnly && !SALES_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))) {
    return <Navigate to="/platform/leads" replace />;
  }
  const nav: readonly NavItem[] = salesOnly
    ? SALES_PATHS.map((p) => NAV.find((item): item is NavLinkItem => 'to' in item && item.to === p)!)
    : NAV;

  const items = nav.filter((item): item is NavLinkItem => 'to' in item);
  const activeTo = items
    .filter((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to;

  return (
    // dvh, not vh: on phones 100vh includes the browser's address bar, which pushed the dock off-screen.
    <div className="scrollbar-dark flex h-dvh overflow-hidden bg-[#0A1628] text-slate-200">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#1E3A5F] bg-[#0F1E35] lg:flex">
        <div className="flex items-center gap-3 border-b border-[#1E3A5F] px-5 py-4">
          <img src="/brand/lumora-logo.svg" alt="" className="h-9 w-9 rounded-full bg-white p-0.5" />
          <div>
            <p className="text-sm font-bold text-white">Lumora Ventures</p>
            <p className="text-[11px] uppercase tracking-wider text-blue-300">{salesOnly ? 'FirmiCore sales' : 'FirmiCore platform'}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            if ('section' in item) return <p key={item.section} className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{item.section}</p>;
            const { to, label, icon: Icon } = item;
            const end = item.end ?? false;
            return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-[#142849] hover:text-white'}`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
              <NavBadge count={badges[to] ?? 0} title={BADGE_TITLE[to]} />
            </NavLink>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-[#1E3A5F] p-3">
          {isDeviceNotificationSupported() && permission === 'default' && (
            <button
              onClick={() => void requestDeviceNotificationPermission().then(setPermission)}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-amber-300 hover:bg-[#142849]"
            >
              <BellRing className="h-4 w-4" /> Enable desktop notifications
            </button>
          )}
          <p className="truncate px-3 pb-1 text-xs text-slate-500">{email}</p>
          {hasCompany && (
            <Link to="/app/dashboard" className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-[#142849]">
              <ArrowLeft className="h-4 w-4" /> Back to FirmiCore
            </Link>
          )}
          <button onClick={() => void logout()} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-[#142849]">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex h-dvh min-w-0 flex-1 flex-col">
        {/* Phone / tablet: the same top bar + floating icon dock as the client app. */}
        <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#1E3A5F] bg-[#0F1E35] px-4 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/brand/lumora-logo.svg" alt="" className="h-7 w-7 rounded-full bg-white p-0.5" />
            <span className="truncate text-sm font-semibold tracking-tight text-slate-100">{salesOnly ? 'FirmiCore sales' : 'FirmiCore platform'}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!salesOnly && <PlatformBell paymentAlerts={paymentAlerts} requests={unread} />}
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#1E3A5F] bg-[#142849] text-[#D5DEEA] hover:bg-[#1E3A5F]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 lg:py-6">
          {!salesOnly && (
            <div className="mb-4 hidden justify-end lg:flex">
              <PlatformBell paymentAlerts={paymentAlerts} requests={unread} />
            </div>
          )}
          <Outlet context={{ paymentAlerts }} />
        </main>

        <nav aria-label="Console navigation" className="shrink-0 px-3 pb-2 pt-1 lg:hidden">
          <div
            className="scrollbar-hide flex gap-1.5 overflow-x-auto rounded-2xl border border-[#1E3A5F] bg-[#0F1E35]/95 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
            style={{ scrollSnapType: 'x proximity' }}
          >
            {items.map(({ to, label, icon: Icon }) => {
              const active = to === activeTo;
              const count = badges[to] ?? 0;
              return (
                <NavLink
                  key={to}
                  to={to}
                  aria-label={label}
                  title={label}
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    active
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.5)]'
                      : 'text-[#9FB3D1]'
                  }`}
                  style={{ scrollSnapAlign: 'center' }}
                >
                  <Icon className="h-5 w-5" />
                  {count > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
