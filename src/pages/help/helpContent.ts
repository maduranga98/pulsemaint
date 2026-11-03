import type { UserRole } from '@/types/auth';

export type HelpModuleId =
  | 'machines'
  | 'breakdowns'
  | 'workOrders'
  | 'myWorkOrders'
  | 'pmSchedules'
  | 'workPermits'
  | 'safetyCases'
  | 'safetyTrainings'
  | 'safetyBlacklist'
  | 'inventory'
  | 'po'
  | 'requests'
  | 'triage'
  | 'training'
  | 'traineeManagement'
  | 'myTraining'
  | 'myProgram'
  | 'myCertificates'
  | 'contractors'
  | 'myShift'
  | 'shiftHandovers'
  | 'analytics'
  | 'moe'
  | 'reports'
  | 'audit'
  | 'evaluations'
  | 'settings'
  | 'billing';

// Where the "Open" link on each help card sends the user. Kept as its own
// map (rather than deriving from AppLayout's NAV_GROUPS) so this module has
// no dependency on the sidebar's React/JSX icons.
export const HELP_MODULE_ROUTES: Record<HelpModuleId, string> = {
  machines: '/app/machines',
  breakdowns: '/app/breakdowns',
  workOrders: '/app/work-orders',
  myWorkOrders: '/app/my-work-orders',
  pmSchedules: '/app/pm-schedules',
  workPermits: '/app/safety/permits',
  safetyCases: '/app/safety/cases',
  safetyTrainings: '/app/training/manage/safety-trainings',
  safetyBlacklist: '/app/safety/blacklist',
  inventory: '/app/inventory/catalog',
  po: '/app/inventory/purchase-orders',
  requests: '/app/inventory/requests',
  triage: '/app/triage',
  training: '/app/training',
  traineeManagement: '/app/training/manage/assignments',
  myTraining: '/app/training/my-modules',
  myProgram: '/app/training/my-program',
  myCertificates: '/app/training/my-certificates',
  contractors: '/app/contractors',
  myShift: '/app/shift/my',
  shiftHandovers: '/app/shift/handover/history',
  analytics: '/app/analytics',
  moe: '/app/moe',
  reports: '/app/reports',
  audit: '/app/audit',
  evaluations: '/app/evaluations',
  settings: '/app/settings',
  billing: '/app/billing',
};

// Which help topics each role sees, mirroring the roles each item is given
// in NAV_GROUPS (src/components/layout/AppLayout.tsx). Like that file, this
// is maintained by hand rather than derived — kept here as its own source of
// truth so this page doesn't depend on the sidebar's JSX icons. When a
// role's nav access changes, update this list too (same nav-vs-access drift
// risk called out in CLAUDE.md for NAV_ITEMS).
export const ROLE_HELP_MODULES: Record<UserRole, HelpModuleId[]> = {
  admin: [
    'machines', 'breakdowns', 'workOrders', 'myWorkOrders', 'pmSchedules',
    'workPermits', 'safetyCases', 'safetyTrainings', 'safetyBlacklist',
    'inventory', 'po', 'requests', 'triage', 'training', 'traineeManagement',
    'contractors', 'myShift', 'shiftHandovers', 'analytics', 'moe', 'reports',
    'audit', 'evaluations', 'settings', 'billing',
  ],
  plant_manager: [
    'machines', 'breakdowns', 'workOrders', 'myWorkOrders', 'pmSchedules',
    'workPermits', 'safetyCases', 'safetyTrainings', 'inventory', 'po',
    'requests', 'triage', 'training', 'traineeManagement', 'contractors',
    'myShift', 'shiftHandovers', 'analytics', 'moe', 'reports', 'audit',
    'evaluations', 'settings',
  ],
  supervisor: [
    'machines', 'breakdowns', 'workOrders', 'pmSchedules', 'workPermits',
    'safetyCases', 'myTraining', 'triage', 'contractors', 'myShift',
    'analytics', 'moe', 'reports',
  ],
  technician: ['machines', 'triage', 'myShift', 'myCertificates'],
  store_keeper: [
    'inventory', 'po', 'requests', 'triage', 'myShift', 'myCertificates',
    'analytics', 'reports',
  ],
  hr_officer: [
    'training', 'traineeManagement', 'triage', 'contractors', 'myShift',
    'shiftHandovers', 'analytics', 'reports', 'audit', 'evaluations',
    'settings',
  ],
  trainee: ['machines', 'triage', 'myProgram', 'myCertificates', 'myShift'],
  floor_operator: ['triage', 'myShift', 'myCertificates'],
  safety_officer: [
    'breakdowns', 'workPermits', 'safetyCases', 'safetyTrainings', 'triage',
    'myShift', 'analytics', 'reports', 'audit',
  ],
};

// ---------------------------------------------------------------------------
// Video guides. They play inside the app (privacy-friendly youtube-nocookie
// embed) — never as a link out to YouTube. A video that belongs to a module is
// listed under that module's help card; the rest go in "Other videos".
// ---------------------------------------------------------------------------
export interface HelpVideo {
  /** YouTube video id (the part after youtu.be/). */
  youtubeId: string;
  title: string;
}

export const HELP_MODULE_VIDEOS: Partial<Record<HelpModuleId, HelpVideo[]>> = {
  machines: [{ youtubeId: 'W_JFLAtiojo', title: 'Add machine guide' }],
  breakdowns: [{ youtubeId: 'SVI_opgKNGY', title: 'FirmiCore Breakdown Guide' }],
  inventory: [{ youtubeId: 'GFDBfb-B_z4', title: 'FirmiCore Inventory Procedure Guide' }],
  contractors: [{ youtubeId: 'MfbBBXeVE0A', title: 'FirmiCore Contractor Management' }],
};

// Videos with no matching help category (getting started, overviews).
export const HELP_OTHER_VIDEOS: HelpVideo[] = [
  { youtubeId: 'lBycQlUeum0', title: 'Register a company' },
  { youtubeId: 'j2WVzhZ3jao', title: 'FirmiCore Product Walkthrough Video' },
  { youtubeId: 'z5hd7U9Hu8s', title: 'FirmiCore Role Dashboards Guide' },
  { youtubeId: 'Cx9mHbETq1Y', title: 'FirmiCore Features Video' },
];

/** Embed URL for a video; autoplay is on because it only loads after a click. */
export function helpVideoEmbedUrl(youtubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0&modestbranding=1`;
}

export function helpVideoThumbnailUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;
}
