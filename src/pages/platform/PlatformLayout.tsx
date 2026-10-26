import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Building2, ClipboardList, CreditCard, Gauge, LogOut, ArrowLeft, BellRing, Home, KanbanSquare, List, BarChart3, Hourglass, Bug, CheckCircle2, LayoutDashboard, Inbox, PhoneForwarded, Phone, PhoneMissed, CalendarCheck, CalendarClock, FlaskConical, Rocket, Trophy, Contact, PhoneCall, Wallet, Lightbulb, ListTodo, UserX, Layers, UserCog } from 'lucide-react';
import { useSuperadmin } from '@/lib/platform/useSuperadmin';
import { usePlatformUnread } from '@/lib/platform/usePlatformUnread';
import { usePaymentAlerts } from '@/lib/platform/usePaymentAlerts';
import { useCallsDue } from '@/lib/platform/useCallsDue';
import { usePendingRegistrations } from '@/lib/platform/usePendingRegistrations';
import { useNewLeads, useOpenCancellations, useTodayReminders, useTodosDue, useUnseenFeatureRequests } from '@/lib/platform/useNavBadges';
import { getNotificationPermission, isDeviceNotificationSupported, requestDeviceNotificationPermission } from '@/lib/notifications/deviceNotify';
import { logout } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
import AuthLoading from '@/components/auth/AuthLoading';
import SuperadminActivatePage from './SuperadminActivatePage';
import PlatformBell from './PlatformBell';
import PlatformLauncher from './PlatformLauncher';
import { LEADS_VIEW_KEY, subNavFor, type SubIcon } from '@/lib/platform/subNav';

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
const SUB_ICON: Record<SubIcon, typeof Gauge> = {
  board: KanbanSquare, list: List, insights: BarChart3, trials: Hourglass, feature: Lightbulb, bug: Bug, open: ListTodo, done: CheckCircle2,
  dashboard: LayoutDashboard, new: Inbox, follow_up: PhoneForwarded, called: Phone, not_answered: PhoneMissed, demo_booked: CalendarCheck,
  demo_done: CalendarClock, trial_requested: FlaskConical, using_trial: Rocket, closed_won: Trophy,
};

/** Phone start page (the launcher) and the pages a sales manager may open. */
const HOME_PATH = '/platform/home';
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
  const { ready, signedIn, isSuperadmin, isSalesManager, email, uid } = useSuperadmin();
  const salesOnly = isSalesManager && !isSuperadmin;
  const salesAccess = isSuperadmin || isSalesManager;
  const hasCompany = useAuthStore((s) => !!s.userProfile);
  const location = useLocation();
  const unread = usePlatformUnread(ready && isSuperadmin);
  const paymentAlerts = usePaymentAlerts(ready && isSuperadmin);
  const callsDue = useCallsDue(ready && salesAccess);
  const pendingRegistrations = usePendingRegistrations(ready && salesAccess);
  // A sales manager's to-dos are their own: nothing else is readable (or counted).
  const todoOwner = isSuperadmin ? null : uid;
  const todoEnabled = ready && salesAccess && (isSuperadmin || !!uid);
  const todosDue = useTodosDue(todoEnabled, todoOwner);
  const reminders = useTodayReminders(todoEnabled, todoOwner);
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
  if (salesOnly && location.pathname !== HOME_PATH && !SALES_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))) {
    return <Navigate to={window.matchMedia('(max-width: 1023px)').matches ? HOME_PATH : '/platform/leads'} replace />;
  }
  const nav: readonly NavItem[] = salesOnly
    ? SALES_PATHS.map((p) => NAV.find((item): item is NavLinkItem => 'to' in item && item.to === p)!)
    : NAV;

  const items = nav.filter((item): item is NavLinkItem => 'to' in item);
  const isHome = location.pathname === HOME_PATH;
  let storedLeadsView: string | null = null;
  try {
    storedLeadsView = localStorage.getItem(LEADS_VIEW_KEY);
  } catch { /* private mode */ }
  const subAll = subNavFor(location.pathname, location.search, storedLeadsView);
  // A sales manager's to-dos are only open reminders: no Open/Done switch.
  const sub = salesOnly && location.pathname.startsWith('/platform/todos') ? { items: [], activeId: null } : subAll;
  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}${email ? `, ${email.split('@')[0]}` : ''}`;

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
          <Link to={HOME_PATH} className="flex min-h-[44px] min-w-0 items-center gap-2">
            <img src="/brand/lumora-logo.svg" alt="" className="h-7 w-7 rounded-full bg-white p-0.5" />
            <span className="truncate text-sm font-semibold tracking-tight text-slate-100">{salesOnly ? 'FirmiCore sales' : 'FirmiCore platform'}</span>
          </Link>
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
          {isHome && <PlatformLauncher greeting={greeting} reminders={reminders} tiles={items.map((i) => ({ to: i.to, label: i.label, icon: i.icon, badge: badges[i.to] ?? 0, badgeTitle: BADGE_TITLE[i.to] }))} />}
          {!salesOnly && (
            <div className="mb-4 hidden justify-end lg:flex">
              <PlatformBell paymentAlerts={paymentAlerts} requests={unread} />
            </div>
          )}
          {!isHome && <Outlet context={{ paymentAlerts }} />}
        </main>

        {!isHome && (
          <nav aria-label="Console navigation" className="shrink-0 px-3 pb-2 pt-1 lg:hidden">
            <div className="scrollbar-hide flex gap-1.5 overflow-x-auto rounded-2xl border border-[#1E3A5F] bg-[#0F1E35]/95 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.4)]">
              <Link to={HOME_PATH} aria-label="Home" title="Home" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-[#D5E2F5]">
                <Home className="h-5 w-5" />
              </Link>
              {sub.items.map((it) => {
                const Icon = SUB_ICON[it.icon];
                const active = it.id === sub.activeId;
                return (
                  <Link
                    key={it.id}
                    to={it.to}
                    replace
                    aria-label={it.label}
                    title={it.label}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      active ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.5)]' : 'text-[#9FB3D1]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
