/**
 * Phone dock of the platform console: inside a tab the dock shows only the
 * Home button and that tab's own sub-views (e.g. Feature requests → Features,
 * Bugs), like the client app's launcher/dock. Pure so it can be unit-tested.
 */

export type SubIcon = 'board' | 'list' | 'insights' | 'trials' | 'feature' | 'bug' | 'open' | 'done';

export interface SubNavItem {
  id: string;
  label: string;
  /** Path + query the dock button links to. */
  to: string;
  icon: SubIcon;
}

export const LEADS_VIEW_KEY = 'platformLeads.view';
export const LEAD_VIEWS = ['board', 'list', 'insights', 'trials'] as const;
export type LeadView = (typeof LEAD_VIEWS)[number];

/** The leads view in the URL, else the one last used on this device, else the board. */
export function leadsViewFrom(search: string, stored: string | null): LeadView {
  const q = new URLSearchParams(search).get('view');
  const pick = (v: string | null) => (LEAD_VIEWS as readonly string[]).includes(v ?? '') ? (v as LeadView) : null;
  return pick(q) ?? pick(stored) ?? 'board';
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
      items: [
        { id: 'board', label: 'Board', to: '/platform/leads?view=board', icon: 'board' },
        { id: 'list', label: 'List', to: '/platform/leads?view=list', icon: 'list' },
        { id: 'insights', label: 'Insights', to: '/platform/leads?view=insights', icon: 'insights' },
        { id: 'trials', label: 'Trial requests', to: '/platform/leads?view=trials', icon: 'trials' },
      ],
      activeId: leadsViewFrom(search, storedLeadsView),
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
