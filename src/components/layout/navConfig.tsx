import type { ReactNode } from 'react';
import type { UserRole } from '../../types/auth';
import { disabledModuleForPath } from '../../lib/companyModules';

export interface NavItem {
  labelKey: string;
  to: string;
  roles: UserRole[];
  icon: ReactNode;
}

export interface NavGroup {
  id: string;
  labelKey: string;
  items: NavItem[];
}

export const iconClass = 'w-[18px] h-[18px] shrink-0';

export const Icon = {
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
  inbox: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
  ),
  message: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  ),
  help: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ),
  chevron: (
    <svg className="w-3.5 h-3.5 shrink-0 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
  ),
};

// Dashboard is the landing page — kept outside every group so it's always
// one click away instead of buried inside a collapsed section.
export const DASHBOARD_ITEM: NavItem = {
  labelKey: 'common.nav.dashboard',
  to: '/app/dashboard',
  icon: Icon.dashboard,
  roles: ['safety_officer', 'plant_manager', 'admin', 'supervisor', 'technician', 'store_keeper', 'hr_officer', 'trainee', 'floor_operator'],
};

// Help & Support is available to every role — kept outside the collapsible
// groups for the same reason as Dashboard. The page itself filters its
// content by role (see ROLE_HELP_MODULES in src/pages/help/helpContent.ts),
// so every role is listed here.
export const HELP_ITEM: NavItem = {
  labelKey: 'common.nav.help',
  to: '/app/help',
  icon: Icon.help,
  roles: ['safety_officer', 'plant_manager', 'admin', 'supervisor', 'technician', 'store_keeper', 'hr_officer', 'trainee', 'floor_operator'],
};

// Everything else is organized into collapsible sub-tabs (see NavGroup /
// the sidebar's accordion below) instead of one long flat list, so a given
// role only has to scan the handful of categories relevant to them.
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'maintenance',
    labelKey: 'common.nav.groups.maintenance',
    items: [
      { labelKey: 'common.nav.items.machines', to: '/app/machines', icon: Icon.machines, roles: ['supervisor', 'plant_manager', 'admin', 'technician', 'trainee'] },
      // floor_operator no longer has a standalone Breakdowns tab — reporting
      // and their department's breakdown status now live on their dashboard
      // instead (see ReportBreakdownWidget / MyDepartmentBreakdownsWidget on
      // FloorOperatorDashboard).
      { labelKey: 'common.nav.items.breakdowns', to: '/app/breakdowns', icon: Icon.report, roles: ['safety_officer', 'supervisor', 'plant_manager', 'admin'] },
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
      // HR officer still has no "Safety Cases" nav entry — HR officer's
      // Safety tab was removed entirely. Safety officer now gets a full
      // nav entry too (in addition to the "Open Safety Cases" dashboard
      // widget), since the case board is their primary EHS workspace.
      { labelKey: 'common.nav.items.safetyCases', to: '/app/safety/cases', icon: Icon.report, roles: ['admin', 'plant_manager', 'supervisor', 'safety_officer', 'store_keeper'] },
      // Frontline roles a safety case can be assigned down to for action land
      // on the same page's "Reported to Me" filtered view. Store keeper's
      // dashboard SafetyForYouWidget is display-only, so they get this entry
      // to act on cases reported to them. floor_operator has no standalone
      // Safety tab — their safety cases/trainings surface on their dashboard
      // (FloorOperatorDashboard's MySafetyCasesWidget/MySafetyTrainingsWidget).
      // Safety officer and HR officer now use admin's "Safety Trainings" tab
      // (scheduling safety training sessions) instead of their own separate
      // entries (a general module library link, and a standalone calendar tab).
      // Supervisor no longer gets this tab — they can't manage/assign/create
      // safety training modules, only complete the ones assigned to them,
      // which now surfaces on their dashboard instead (see
      // MySafetyTrainingsWidget on SupervisorDashboard).
      { labelKey: 'common.nav.items.safetyTrainings', to: '/app/training/manage/safety-trainings', icon: Icon.book, roles: ['plant_manager', 'admin', 'safety_officer'] },
      // Admin/plant manager/safety officer/HR officer reach the
      // calendar via the "View Training Schedules" button on the Safety
      // Trainings page instead of a dedicated nav entry. floor_operator's
      // safety trainings now surface on their dashboard instead (see
      // MySafetyTrainingsWidget on FloorOperatorDashboard).
      // Blacklist: technicians/contractors/operators/machines that hit the
      // safety-case point threshold. Admin-only — clearing it is a
      // destructive, company-wide action (see firestore.rules).
      { labelKey: 'common.nav.items.safetyBlacklist', to: '/app/safety/blacklist', icon: Icon.report, roles: ['admin'] },
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
      // store_keeper dropped from here too — InventoryDashboard already
      // shows the same MyTrainingsWidget; the route itself (no requiredRoles)
      // stays reachable so that widget's links to a specific assignment
      // still work.
      { labelKey: 'common.nav.items.myTraining', to: '/app/training/my-modules', icon: Icon.book, roles: ['supervisor', 'plant_manager', 'safety_officer', 'store_keeper', 'hr_officer'] },
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
      // Staff requests: every role except admin raises them; supervisors,
      // plant managers and admins answer the ones addressed to them.
      { labelKey: 'common.nav.items.myRequests', to: '/app/requests', icon: Icon.message, roles: ['plant_manager', 'supervisor', 'technician', 'store_keeper', 'hr_officer', 'trainee', 'floor_operator', 'safety_officer'] },
      { labelKey: 'common.nav.items.requestsInbox', to: '/app/requests/inbox', icon: Icon.inbox, roles: ['supervisor', 'plant_manager', 'admin'] },
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
      {
        labelKey: 'common.nav.items.supportRequests',
        to: '/app/support-requests',
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/>
          </svg>
        ),
        roles: ['admin'] as UserRole[],
      },
    ],
  },
];

/** Phone launcher screen (first view of a session on phones/tablets). */
export const LAUNCHER_PATH = '/app/home';

type NavCompany = Parameters<typeof disabledModuleForPath>[0];

/** Everything the signed-in role may open, in sidebar order. */
export function visibleNav(role: UserRole | undefined, company: NavCompany) {
  const dashboard = role && DASHBOARD_ITEM.roles.includes(role) ? DASHBOARD_ITEM : null;
  const help = role && HELP_ITEM.roles.includes(role) ? HELP_ITEM : null;
  // A group with nothing left to show is dropped rather than rendering an empty header.
  const groups = role
    ? NAV_GROUPS
        .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role) && !disabledModuleForPath(company, i.to)) }))
        .filter((g) => g.items.length > 0)
    : [];
  return { dashboard, groups, help };
}

export type VisibleNav = ReturnType<typeof visibleNav>;

/** Flat list for the phone launcher and icon dock: dashboard, every group item, help. */
export function flatNav(nav: VisibleNav): NavItem[] {
  return [
    ...(nav.dashboard ? [nav.dashboard] : []),
    ...nav.groups.flatMap((g) => g.items),
    ...(nav.help ? [nav.help] : []),
  ];
}
