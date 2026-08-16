import { useMemo, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useAuthActions } from '../../hooks/useAuthActions';
import type { UserRole } from '../../types/auth';
import EndShiftButton from '../handover/EndShiftButton';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';
import ErrorBoundary from '../ErrorBoundary';

interface NavItem {
  labelKey: string;
  to: string;
  roles: UserRole[];
  icon: ReactNode;
}

interface NavGroup {
  id: string;
  labelKey: string;
  items: NavItem[];
}

const iconClass = 'w-[18px] h-[18px] shrink-0';

const Icon = {
  dashboard: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
  ),
  machines: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>
  ),
  alert: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ),
  report: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
  ),
  wrench: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4.5 4.5 0 0 0 6 6L17 16v3l-2 2h-3l-2-2v-3l3.7-3.7a4.5 4.5 0 0 0-6-6L8 8l-2-2V3L4 1H1l2 2v3l2 2h3z"/></svg>
  ),
  box: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
  ),
  graduation: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5a6 3 0 0 0 12 0v-5"/></svg>
  ),
  book: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
  ),
  users: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  settings: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1Z"/></svg>
  ),
  menu: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  ),
  chevron: (
    <svg className="w-3.5 h-3.5 shrink-0 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
  ),
};

// Dashboard is the landing page — kept outside every group so it's always
// one click away instead of buried inside a collapsed section.
const DASHBOARD_ITEM: NavItem = {
  labelKey: 'common.nav.dashboard',
  to: '/app/dashboard',
  icon: Icon.dashboard,
  roles: ['safety_officer', 'plant_manager', 'admin', 'supervisor', 'technician', 'store_keeper', 'hr_officer', 'trainee'],
};

// Everything else is organized into collapsible sub-tabs (see NavGroup /
// the sidebar's accordion below) instead of one long flat list, so a given
// role only has to scan the handful of categories relevant to them.
const NAV_GROUPS: NavGroup[] = [
  {
    id: 'maintenance',
    labelKey: 'common.nav.groups.maintenance',
    items: [
      { labelKey: 'common.nav.items.machines', to: '/app/machines', icon: Icon.machines, roles: ['supervisor', 'plant_manager', 'admin', 'technician', 'trainee'] },
      { labelKey: 'common.nav.items.breakdowns', to: '/app/breakdowns', icon: Icon.report, roles: ['safety_officer', 'floor_operator', 'supervisor', 'plant_manager', 'admin'] },
      { labelKey: 'common.nav.items.workOrders', to: '/app/work-orders', icon: Icon.wrench, roles: ['supervisor', 'plant_manager', 'admin'] },
      { labelKey: 'common.nav.items.myWorkOrders', to: '/app/my-work-orders', icon: Icon.wrench, roles: ['plant_manager'] },
      {
        labelKey: 'common.nav.items.pmSchedules',
        to: '/app/pm-schedules',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        ),
        roles: ['supervisor', 'plant_manager', 'admin'],
      },
    ],
  },
  {
    id: 'safety',
    labelKey: 'common.nav.groups.safety',
    items: [
      { labelKey: 'common.nav.items.workPermits', to: '/app/safety/permits', icon: Icon.report, roles: ['safety_officer', 'admin', 'plant_manager', 'supervisor'] },
      // HR officer and safety officer no longer have a "Safety Cases" nav
      // entry at all — HR officer's Safety tab was removed entirely, and
      // safety officer now works their case board from the "Open Safety
      // Cases" widget on their dashboard instead (see OpenSafetyCasesWidget
      // on ManagerDashboard, which safety_officer shares); both still have
      // route-level access to the page if linked to directly.
      { labelKey: 'common.nav.items.safetyCases', to: '/app/safety/cases', icon: Icon.report, roles: ['admin', 'plant_manager', 'supervisor'] },
      // Frontline roles a safety case can be assigned down to for action — they
      // land on the same page's "Reported to Me" filtered view. Store keeper
      // has no standalone Safety tab — their safety cases/trainings surface
      // on their dashboard instead (see InventoryDashboard's SafetyForYouWidget).
      { labelKey: 'common.nav.items.safetyCases', to: '/app/safety/cases', icon: Icon.report, roles: ['floor_operator'] },
      // Safety officer and HR officer now use admin's "Safety Trainings" tab
      // (scheduling safety training sessions) instead of their own separate
      // entries (a general module library link, and a standalone calendar tab).
      { labelKey: 'common.nav.items.safetyTrainings', to: '/app/training/manage/safety-trainings', icon: Icon.book, roles: ['plant_manager', 'admin', 'supervisor', 'safety_officer'] },
      // Admin/plant manager/supervisor/safety officer/HR officer reach the
      // calendar via the "View Training Schedules" button on the Safety
      // Trainings page instead of a dedicated nav entry; every other role
      // still needs one since they don't have access to that page.
      { labelKey: 'common.nav.items.safetyTrainingSchedules', to: '/app/safety/calendar', icon: Icon.book, roles: ['floor_operator'] },
    ],
  },
  {
    id: 'inventory',
    labelKey: 'common.nav.groups.inventory',
    items: [
      // Parts catalog + low stock alerts + Add Item only — PO and requests
      // now live in their own tabs instead of one page mixing everything.
      { labelKey: 'common.nav.items.inventory', to: '/app/inventory/catalog', icon: Icon.box, roles: ['store_keeper', 'plant_manager', 'admin'] },
      {
        labelKey: 'common.nav.items.po',
        to: '/app/inventory/purchase-orders',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
        ),
        roles: ['store_keeper', 'plant_manager', 'admin'],
      },
      { labelKey: 'common.nav.items.requests', to: '/app/inventory/requests', icon: Icon.report, roles: ['store_keeper', 'plant_manager', 'admin'] },
    ],
  },
  {
    id: 'triage-training',
    labelKey: 'common.nav.groups.triageTraining',
    items: [
      {
        labelKey: 'common.nav.items.triage',
        to: '/app/triage',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        ),
        roles: ['safety_officer', 'floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin', 'hr_officer', 'store_keeper', 'trainee'],
      },
      // Triage Builder is now reached via the "Create" button on the Triage
      // page itself (opens inline, with its own back button) instead of a
      // separate nav entry — the route still exists for direct links.
      { labelKey: 'common.nav.items.training', to: '/app/training', icon: Icon.graduation, roles: ['hr_officer', 'plant_manager', 'admin'] },
      { labelKey: 'common.nav.items.traineeManagement', to: '/app/training/manage/assignments', icon: Icon.graduation, roles: ['hr_officer', 'plant_manager', 'admin'] },
      // Trainee's own training tabs live alongside Triage in this same
      // "Triage & Training" group instead of under Workforce, so a trainee's
      // whole day-to-day (troubleshooting + their own program) is one section.
      // Other roles get their outstanding trainings via a dashboard widget
      // instead (see MyTrainingsWidget / TodayMyTrainingsWidget). Trainee's
      // own "My Training" also moved to a dashboard widget — see TraineeDashboard.
      { labelKey: 'common.nav.items.myTraining', to: '/app/training/my-modules', icon: Icon.book, roles: ['supervisor', 'store_keeper'] },
      { labelKey: 'common.nav.items.myProgram', to: '/app/training/my-program', icon: Icon.graduation, roles: ['trainee'] },
      // My Certificates lives here for every role that has one, instead of
      // being split across this group and Workforce.
      { labelKey: 'common.nav.items.myCertificates', to: '/app/training/my-certificates', icon: Icon.report, roles: ['trainee', 'floor_operator', 'technician', 'store_keeper'] },
    ],
  },
  {
    id: 'workforce',
    labelKey: 'common.nav.groups.workforce',
    items: [
      { labelKey: 'common.nav.items.contractors', to: '/app/contractors', icon: Icon.users, roles: ['supervisor', 'plant_manager', 'admin', 'hr_officer'] },
      // Shift Configuration is no longer a standalone nav entry — it's
      // reached via the "Shift Configuration" button on the Shift Handovers
      // page instead (same admin/plant_manager/hr_officer audience as the
      // shiftHandovers nav item below), so it isn't duplicated in the sidebar.
      {
        labelKey: 'common.nav.items.myShift',
        to: '/app/shift/my',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
          </svg>
        ),
        roles: ['safety_officer', 'floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin', 'hr_officer', 'store_keeper', 'trainee'],
      },
      {
        labelKey: 'common.nav.items.shiftHandovers',
        to: '/app/shift/handover/history',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 7h10"/><path d="M7 12h7"/><path d="M7 17h5"/><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M16 3v4h4"/>
          </svg>
        ),
        roles: ['plant_manager', 'admin', 'hr_officer'],
      },
      // "My Training" nav entries for other roles were dropped in favor of
      // dashboard widgets (see MyTrainingsWidget); trainee's own "My Training"
      // / "My Program", and "My Certificates" for every role that has one,
      // live under Triage & Training instead (see that group).
    ],
  },
  {
    id: 'insights',
    labelKey: 'common.nav.groups.insights',
    items: [
      {
        labelKey: 'common.nav.items.analytics',
        to: '/app/analytics',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>
          </svg>
        ),
        roles: ['plant_manager', 'admin', 'supervisor', 'store_keeper', 'safety_officer', 'hr_officer'],
      },
      {
        labelKey: 'common.nav.items.moe',
        to: '/app/moe',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
          </svg>
        ),
        roles: ['supervisor', 'plant_manager', 'admin'],
      },
      { labelKey: 'common.nav.items.reports', to: '/app/reports', icon: Icon.report, roles: ['safety_officer', 'supervisor', 'plant_manager', 'hr_officer', 'admin', 'store_keeper'] },
      {
        labelKey: 'common.nav.items.audit',
        to: '/app/audit',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/><path d="M9 7h6"/>
          </svg>
        ),
        roles: ['safety_officer', 'plant_manager', 'admin', 'hr_officer'],
      },
      {
        labelKey: 'common.nav.items.evaluations',
        to: '/app/evaluations',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
        ),
        roles: ['plant_manager', 'admin', 'hr_officer'],
      },
    ],
  },
  {
    id: 'admin',
    labelKey: 'common.nav.groups.admin',
    items: [
      // Users moved inside Settings — same access as before (Users' union of
      // roles), just reached via the Settings tile instead of its own
      // top-level nav entry. Shifts moved to the Workforce group above.
      { labelKey: 'common.nav.items.settings', to: '/app/settings', icon: Icon.settings, roles: ['admin', 'plant_manager', 'hr_officer'] },
      {
        labelKey: 'common.nav.items.billing',
        to: '/app/billing',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
        ),
        roles: ['admin'] as UserRole[],
      },
    ],
  },
];

function TrialExpiryBanner() {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  if (!company || company.status !== 'trial') return null;

  const daysLeft = company.trialEndsAt
    ? Math.ceil((company.trialEndsAt.toDate().getTime() - Date.now()) / 86_400_000)
    : null;

  const expired = daysLeft !== null && daysLeft <= 0;
  const urgent = daysLeft !== null && daysLeft <= 7;

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
  const { logout } = useAuthActions();
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = userProfile?.role;

  const visibleDashboard = role && DASHBOARD_ITEM.roles.includes(role) ? DASHBOARD_ITEM : null;

  // Each group keeps only the items this role can see; a group with nothing
  // left to show is dropped entirely rather than rendering an empty header.
  const visibleGroups = useMemo(() => {
    if (!role) return [];
    return NAV_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) }))
      .filter((g) => g.items.length > 0);
  }, [role]);

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
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen bg-[#0A1628] text-[#F0F4F8] flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-[#0F1E35] border-r border-[#1E3A5F] flex flex-col transform transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 flex items-center px-5 border-b border-[#1E3A5F] shrink-0">
          <img src="/logo.svg" alt="FirmiCore" className="w-7 h-7 rounded-md mr-2 object-contain" />
          <span className="text-sm font-semibold tracking-tight text-[#F0F4F8] font-[Sora]">
            FirmiCore
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
          {visibleDashboard && (
            <NavLink
              to={visibleDashboard.to}
              end
              onClick={() => setSidebarOpen(false)}
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
                        onClick={() => setSidebarOpen(false)}
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
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-14 shrink-0 bg-[#0F1E35] border-b border-[#1E3A5F] flex items-center justify-between px-4 lg:px-6 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-[#142849] text-[#8BA3BF]"
              aria-label="Toggle navigation"
            >
              {Icon.menu}
            </button>
            <div className="text-[13px] text-[#8BA3BF] hidden sm:block truncate">
              {company?.name ?? ''}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <NotificationBell />
            <EndShiftButton />
            <div className="text-right hidden sm:block leading-tight">
              <div className="text-[13px] font-medium text-[#F0F4F8] truncate max-w-[160px]">
                {userProfile?.fullName ?? 'User'}
              </div>
              <div className="text-[11px] text-[#8BA3BF]">{roleLabel(role)}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#1A56DB]/20 text-[#60A5FA] flex items-center justify-center text-[12px] font-semibold border border-[#1E3A5F]">
              {initials(userProfile?.fullName)}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 text-[12px] font-medium text-[#D5DEEA] bg-[#142849] border border-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-[#F0F4F8] rounded-md transition-colors"
            >
              {t('common.signOut')}
            </button>
          </div>
        </header>

        <main className="app-main-dark flex-1 min-w-0 bg-[#0A1628] overflow-y-auto">
          <TrialExpiryBanner />
          <div className="px-4 sm:px-6 lg:px-8 py-5 pb-24 sm:pb-5 max-w-[1400px] mx-auto w-full">
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
