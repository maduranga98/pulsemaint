import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import CancellationReasonDialog from '../billing/CancellationReasonDialog';
import RetentionExportBanner from './RetentionExportBanner';
import { useAuthActions } from '../../hooks/useAuthActions';
import type { UserRole } from '../../types/auth';
import EndShiftButton from '../handover/EndShiftButton';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';
import ErrorBoundary from '../ErrorBoundary';
import PlantTabs from './PlantTabs';
import { useSupportUnreadCount } from '../../hooks/useSupportUnreadCount';
import { useTour } from '../../features/tour/TourProvider';
import { companyApproval } from '../../lib/companyApproval';
import { isTrialExpired } from '../../lib/planLimits';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Icon, LAUNCHER_PATH, visibleNav } from './navConfig';
import MobileDock from './MobileDock';

/** Set once per browser session so the phone launcher is only the *first* screen. */
const LAUNCHER_SEEN_KEY = 'firmicore:launcherSeen';

/**
 * Opens the main guided tour once, the first time a user lands on their dashboard on a desktop screen,
 * and again whenever Help → "Take the guided tour" sends the user here (`state.startTour`).
 */
function TourAutoStart() {
  const { startOnce, start, running } = useTour();
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const requested = (state as { startTour?: string } | null)?.startTour === 'main';
  useEffect(() => {
    if (!requested || !pathname.startsWith('/app/dashboard')) return;
    // Wait for the dashboard, plant switcher and menu to render so every stop is on screen.
    const timer = window.setTimeout(() => {
      navigate(pathname, { replace: true, state: null });
      start('main');
    }, 900);
    return () => window.clearTimeout(timer);
  }, [requested, pathname, start, navigate]);
  const ready = useAuthStore((s) => {
    const c = s.company;
    if (!s.userProfile || !c) return false;
    if (companyApproval(c.approvalStatus) !== 'approved' || c.status === 'suspended' || isTrialExpired(c)) return false;
    return !(s.userProfile.role === 'admin' && c.cancellationReasonPendingId); // that dialog can't be skipped — don't stack on it
  });
  useEffect(() => {
    if (!ready || running || !pathname.startsWith('/app/dashboard') || window.innerWidth < 1024) return;
    const timer = window.setTimeout(() => startOnce('main'), 1500);
    return () => window.clearTimeout(timer);
  }, [ready, running, pathname, startOnce]);
  return null;
}

function TrialExpiryBanner() {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  if (!company || company.status !== 'trial') return null;

  const daysLeft = company.trialEndsAt
    ? Math.ceil((company.trialEndsAt.toDate().getTime() - Date.now()) / 86_400_000)
    : null;

  const expired = daysLeft !== null && daysLeft <= 0;
  // A trial is 7 days long, so "urgent" means the last 3 days (otherwise the banner would show all trial long).
  const urgent = daysLeft !== null && daysLeft <= 3;

  if (!expired && !urgent) return null;

  return (
    <div
      className={`px-4 py-2 text-sm text-center flex items-center justify-center gap-3 ${
        expired ? 'bg-red-900/80 text-red-100' : 'bg-amber-900/70 text-amber-100'
      }`}
    >
      <span>
        {expired
          ? t('common.trial.expired')
          : t('common.trial.endsIn', { days: daysLeft, plural: daysLeft !== 1 ? 's' : '' })}
      </span>
      <Link
        to="/app/billing"
        className={`font-semibold underline underline-offset-2 hover:no-underline ${
          expired ? 'text-red-200' : 'text-amber-200'
        }`}
      >
        {t('common.trial.upgradeNow')}
      </Link>
    </div>
  );
}

function roleLabel(role?: UserRole) {
  if (!role) return '';
  return role
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function initials(name?: string | null) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

export default function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // The shell is exactly one screen tall and scrolls inside its own panes, so
  // the page behind it must never scroll or show its white background (a
  // stray element after #root used to expose a blank white band under the
  // content).
  useEffect(() => {
    document.documentElement.classList.add('app-shell-active');
    return () => document.documentElement.classList.remove('app-shell-active');
  }, []);
  const { logout } = useAuthActions();
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);

  const role = userProfile?.role;
  const supportUnread = useSupportUnreadCount();

  const nav = useMemo(() => visibleNav(role, company), [role, company]);
  const { dashboard: visibleDashboard, groups: visibleGroups, help: visibleHelp } = nav;

  // Phones and tablets (< lg) have no sidebar: the first screen of a session
  // is the app launcher (/app/home), and inside a module the icon dock below
  // the page replaces the menu. Only the first landing on a dashboard is
  // redirected, so Home → Dashboard from the dock still works afterwards.
  const isPhone = useMediaQuery('(max-width: 1023px)');
  useEffect(() => {
    if (!isPhone || !role) return;
    try {
      if (sessionStorage.getItem(LAUNCHER_SEEN_KEY)) return;
      sessionStorage.setItem(LAUNCHER_SEEN_KEY, '1');
    } catch {
      return; // storage blocked: skip the launcher rather than redirect on every visit
    }
    if (location.pathname === '/app' || location.pathname.startsWith('/app/dashboard')) {
      navigate(LAUNCHER_PATH, { replace: true });
    }
  }, [isPhone, role, location.pathname, navigate]);
  const showDock = isPhone && location.pathname !== LAUNCHER_PATH;

  // Only the category containing the current page starts expanded — every
  // other one stays collapsed so the sidebar doesn't dump every category on
  // screen at once. A manual click can still open/close a different one,
  // but that override resets whenever the route changes so it doesn't get
  // stuck open on a page it no longer matches.
  const activeGroupId = useMemo(
    () => visibleGroups.find((g) => g.items.some((i) => location.pathname.startsWith(i.to)))?.id ?? null,
    [visibleGroups, location.pathname],
  );
  const [manualOpenGroupId, setManualOpenGroupId] = useState<string | null | undefined>(undefined);
  const [lastPathname, setLastPathname] = useState(location.pathname);
  if (lastPathname !== location.pathname) {
    // Route changed since the last render — drop any manual override so the
    // sidebar re-syncs to whichever group actually contains the new page.
    setLastPathname(location.pathname);
    if (manualOpenGroupId !== undefined) setManualOpenGroupId(undefined);
  }
  const openGroupId = manualOpenGroupId !== undefined ? manualOpenGroupId : activeGroupId;

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem(LAUNCHER_SEEN_KEY); // next sign-in on a phone starts at the launcher again
    } catch {
      /* storage blocked — nothing to clear */
    }
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    // dvh, not vh: on phones 100vh includes the browser's address bar, which pushed the dock off-screen.
    <div className="h-dvh bg-[#0A1628] text-[#F0F4F8] flex overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-[#0F1E35] border-r border-[#1E3A5F] flex-col">
        <div className="h-14 flex items-center px-5 border-b border-[#1E3A5F] shrink-0">
          <img src="/logo.svg" alt={t('common.ui2.layout.appLayout.firmicore')} className="w-7 h-7 rounded-md mr-2 object-contain" />
          <span className="text-sm font-semibold tracking-tight text-[#F0F4F8]">
            {t('common.ui2.layout.appLayout.firmicore')}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
          {visibleDashboard && (
            <NavLink
              data-tour="nav-dashboard"
              to={visibleDashboard.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-[#1A56DB]/15 text-[#60A5FA] border-l-2 border-[#1A56DB] pl-[10px]'
                    : 'text-[#8BA3BF] hover:bg-[#142849] hover:text-[#F0F4F8]'
                }`
              }
            >
              {visibleDashboard.icon}
              <span>{t(visibleDashboard.labelKey)}</span>
            </NavLink>
          )}

          {visibleGroups.length > 0 && <div className="my-2 border-t border-[#1E3A5F]" />}

          {visibleGroups.map((group) => {
            const isOpen = openGroupId === group.id;
            const groupHasActive = group.id === activeGroupId;
            return (
              <div key={group.id}>
                <button
                  type="button"
                  data-tour={`nav-group-${group.id}`}
                  onClick={() => setManualOpenGroupId(isOpen ? null : group.id)}
                  aria-expanded={isOpen}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                    groupHasActive ? 'text-[#60A5FA]' : 'text-[#6C87A6] hover:text-[#D5DEEA]'
                  }`}
                >
                  <span>{group.id === 'triage-training' && role === 'technician' ? t('common.nav.items.triage') : t(group.labelKey)}</span>
                  <span className={isOpen ? 'rotate-90' : ''}>{Icon.chevron}</span>
                </button>
                {isOpen && (
                  <div className="space-y-0.5 mb-1">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 pl-6 pr-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                            isActive
                              ? 'bg-[#1A56DB]/15 text-[#60A5FA] border-l-2 border-[#1A56DB] pl-[22px]'
                              : 'text-[#8BA3BF] hover:bg-[#142849] hover:text-[#F0F4F8]'
                          }`
                        }
                      >
                        {item.icon}
                        <span>{t(item.labelKey)}</span>
                        {item.to === '/app/support-requests' && supportUnread > 0 && (
                          <span className="ml-auto rounded-full bg-blue-600 px-1.5 text-[10px] font-bold leading-4 text-white">{supportUnread}</span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {visibleHelp && (
            <>
              <div className="my-2 border-t border-[#1E3A5F]" />
              <NavLink
                data-tour="nav-help"
                to={visibleHelp.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[#1A56DB]/15 text-[#60A5FA] border-l-2 border-[#1A56DB] pl-[10px]'
                      : 'text-[#8BA3BF] hover:bg-[#142849] hover:text-[#F0F4F8]'
                  }`
                }
              >
                {visibleHelp.icon}
                <span>{t(visibleHelp.labelKey)}</span>
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 h-dvh">
        <header className="h-14 shrink-0 bg-[#0F1E35] border-b border-[#1E3A5F] flex items-center justify-between px-4 lg:px-6 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={LAUNCHER_PATH} className="lg:hidden flex items-center gap-2 min-h-[44px]">
              <img src="/logo.svg" alt={t('common.ui2.layout.appLayout.firmicore')} className="w-7 h-7 rounded-md object-contain" />
              <span className="hidden sm:inline text-sm font-semibold tracking-tight text-[#F0F4F8]">
                {t('common.ui2.layout.appLayout.firmicore')}
              </span>
            </Link>
            <div className="text-[13px] text-[#8BA3BF] hidden sm:block truncate">
              {company?.name ?? ''}
            </div>
          </div>

          {/* overflow-x-auto scoped to this action group (not the whole header)
              so a narrow screen that can't fit every action scrolls just this
              row instead of the whole page — an unscoped page-level scroll was
              shifting NotificationBell's anchor and rendering its dropdown
              panel off-screen. */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide shrink-0">
            <LanguageSwitcher />
            <NotificationBell />
            <EndShiftButton />
            <div className="text-right hidden sm:block leading-tight">
              <div className="text-[13px] font-medium text-[#F0F4F8] truncate max-w-[160px]">
                {userProfile?.fullName ?? 'User'}
              </div>
              <div className="text-[11px] text-[#8BA3BF]">{roleLabel(role)}</div>
            </div>
            <div data-tour="profile" className="w-8 h-8 rounded-full bg-[#1A56DB]/20 text-[#60A5FA] flex items-center justify-center text-[12px] font-semibold border border-[#1E3A5F]">
              {initials(userProfile?.fullName)}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label={t('common.signOut')}
              title={t('common.signOut')}
              className="flex h-9 w-9 items-center justify-center sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 text-[12px] font-medium text-[#D5DEEA] bg-[#142849] border border-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-[#F0F4F8] rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('common.signOut')}</span>
            </button>
          </div>
        </header>

        <PlantTabs />

        <main className="app-main-dark flex-1 min-w-0 bg-[#0A1628] overflow-y-auto scrollbar-hide">
          <TourAutoStart />
          <TrialExpiryBanner />
          <RetentionExportBanner />
          {/* A subscription cancelled in the Stripe portal without a reason: admins must give one (can't be skipped). */}
          {role === 'admin' && company?.cancellationReasonPendingId && location.pathname !== '/app/billing' && (
            <CancellationReasonDialog kind="reason" onDone={() => {}} />
          )}
          <div className="px-4 sm:px-6 lg:px-8 py-5 pb-24 sm:pb-5 max-w-[1400px] mx-auto w-full">
            <ErrorBoundary key={location.pathname}>
              {/* Pages build their Firestore queries from the signed-in profile's plant and department (plantConstraints); remount them when those arrive or change so a new user's profile completing late never leaves a page on a stale, rejected query. */}
              <Outlet key={`${userProfile?.role ?? ''}|${userProfile?.plantId ?? ''}|${userProfile?.department ?? ''}`} />
            </ErrorBoundary>
          </div>
        </main>

        {showDock && <MobileDock nav={nav} />}
      </div>
    </div>
  );
}
