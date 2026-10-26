/**
 * Phone dock of the platform console: inside a tab the dock shows only the
 * Home button and that tab's own sub-views (e.g. Feature requests → Features,
 * Bugs), like the client app's launcher/dock. Pure so it can be unit-tested.
 */

export type SubIcon =
  | 'board' | 'list' | 'insights' | 'trials' | 'feature' | 'bug' | 'open' | 'done'
  | 'dashboard' | 'new' | 'follow_up' | 'called' | 'not_answered' | 'demo_booked' | 'demo_done' | 'trial_requested' | 'using_trial' | 'closed_won';

export interface SubNavItem {
  id: string;
  label: string;
  /** Path + query the dock button links to. */
  to: string;
  icon: SubIcon;
}

export const LEADS_VIEW_KEY = 'platformLeads.view';

/** Desktop views of the Leads page (switched with the buttons above the board). */
export const DESKTOP_LEAD_VIEWS = ['board', 'list', 'insights', 'trials'] as const;

/**
 * Phone windows of the Leads page, in dock order: the dashboard, then one
 * window per stage, then analytics. `insights` is the analytics window.
 */
export const PHONE_LEAD_WINDOWS: { id: string; label: string; icon: SubIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'new', label: 'New', icon: 'new' },
  { id: 'follow_up', label: 'Follow-up', icon: 'follow_up' },
  { id: 'called', label: 'Called', icon: 'called' },
  { id: 'not_answered', label: 'Not answered', icon: 'not_answered' },
  { id: 'demo_booked', label: 'Demo booked', icon: 'demo_booked' },
  { id: 'demo_done', label: 'Demo done', icon: 'demo_done' },
  { id: 'trial_requested', label: 'Trial request', icon: 'trial_requested' },
  { id: 'using_trial', label: 'Using trial', icon: 'using_trial' },
  { id: 'closed_won', label: 'Closed won', icon: 'closed_won' },
  { id: 'insights', label: 'Analytics', icon: 'insights' },
];

export type LeadView = (typeof DESKTOP_LEAD_VIEWS)[number] | (typeof PHONE_LEAD_WINDOWS)[number]['id'];
const ALL_LEAD_VIEWS: readonly string[] = [...DESKTOP_LEAD_VIEWS, ...PHONE_LEAD_WINDOWS.map((w) => w.id)];

/**
 * The leads view in the URL; without one a phone opens the dashboard and a
 * desktop the view last used on this device (else the board).
 */
export function leadsViewFrom(search: string, stored: string | null, phone = false): LeadView {
  const pick = (v: string | null) => (ALL_LEAD_VIEWS.includes(v ?? '') ? (v as LeadView) : null);
  const fromUrl = pick(new URLSearchParams(search).get('view'));
  if (fromUrl) return fromUrl;
  return phone ? 'dashboard' : pick(stored) ?? 'board';
}

export function featureTabFrom(search: string): 'feature' | 'bug' {
  return new URLSearchParams(search).get('tab') === 'bug' ? 'bug' : 'feature';
}

export function todoTabFrom(search: string): 'open' | 'done' {
  return new URLSearchParams(search).get('tab') === 'done' ? 'done' : 'open';
}

/** The sub-views of the page at `pathname`, and which one is active. Pages without sub-views return an empty list. */
export function subNavFor(pathname: string, search: string, storedLeadsView: string | null = null): { items: SubNavItem[]; activeId: string | null } {
  const path = pathname.replace(/\/+$/, '');
  if (path === '/platform/leads') {
    return {
      items: PHONE_LEAD_WINDOWS.map((w) => ({ id: w.id, label: w.label, to: `/platform/leads?view=${w.id}`, icon: w.icon })),
      activeId: leadsViewFrom(search, storedLeadsView, true),
    };
  }
  if (path === '/platform/feature-requests') {
    return {
      items: [
        { id: 'feature', label: 'Feature requests', to: '/platform/feature-requests?tab=feature', icon: 'feature' },
        { id: 'bug', label: 'Bugs', to: '/platform/feature-requests?tab=bug', icon: 'bug' },
      ],
      activeId: featureTabFrom(search),
    };
  }
  if (path === '/platform/todos') {
    return {
      items: [
        { id: 'open', label: 'Open', to: '/platform/todos?tab=open', icon: 'open' },
        { id: 'done', label: 'Done', to: '/platform/todos?tab=done', icon: 'done' },
      ],
      activeId: todoTabFrom(search),
    };
  }
  return { items: [], activeId: null };
}
