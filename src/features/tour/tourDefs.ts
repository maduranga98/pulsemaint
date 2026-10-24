import type { TourId } from './tourState';

/**
 * One stop of a tour. `target` is a CSS selector — the tour anchors to elements marked with a
 * `data-tour="..."` attribute in the page, so moving or restyling an element never breaks it.
 * Stops whose target isn't on screen (a role without that menu, a hidden mobile sidebar…) are skipped.
 * Text comes from the locale files (`titleKey` / `bodyKey`), or is given literally for English-only pages.
 */
export interface TourStepDef {
  id: string;
  /** CSS selector of the element to point at; "body" shows a centred card. */
  target: string;
  titleKey?: string;
  bodyKey?: string;
  title?: string;
  body?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center';
}

const sel = (name: string) => `[data-tour="${name}"]`;
const key = (tour: string, id: string, part: 'title' | 'body') => `tour.${tour}.${id}.${part}`;

const main = (id: string, target: string, placement: TourStepDef['placement'] = 'right'): TourStepDef => ({
  id, target, placement, titleKey: key('main', id, 'title'), bodyKey: key('main', id, 'body'),
});

/** The sidebar menu groups, in the order they appear (see NAV_GROUPS in AppLayout). */
export const NAV_GROUP_TOUR_IDS = ['maintenance', 'safety', 'inventory', 'triage-training', 'workforce', 'insights', 'admin'] as const;
/** Locale-safe id for a group (no hyphen). */
export const groupStepId = (groupId: string) => `group_${groupId.replace(/-/g, '_')}`;

export const TOUR_DEFS: Record<TourId, TourStepDef[]> = {
  main: [
    main('welcome', 'body', 'center'),
    main('dashboard', sel('nav-dashboard')),
    main('plants', sel('plant-tabs'), 'bottom'),
    // Phone launcher stops — these targets only exist on /app/home, so desktop skips them.
    main('launcher_search', sel('launcher-search'), 'bottom'),
    main('launcher_apps', sel('launcher-apps'), 'top'),
    ...NAV_GROUP_TOUR_IDS.map((g) => main(groupStepId(g), sel(`nav-group-${g}`))),
    main('language', sel('language'), 'bottom'),
    main('notifications', sel('notifications'), 'bottom'),
    main('shift', sel('shift'), 'bottom'),
    // The phone's floating start/end-shift button (launcher only) shares the shift text.
    { id: 'shift_mobile', target: sel('shift-fab'), placement: 'top', titleKey: key('main', 'shift', 'title'), bodyKey: key('main', 'shift', 'body') },
    main('profile', sel('profile'), 'bottom'),
    main('help', sel('nav-help'), 'right'),
  ],
  machine: [
    { id: 'status', target: sel('machine-status'), placement: 'bottom', titleKey: key('machine', 'status', 'title'), bodyKey: key('machine', 'status', 'body') },
    { id: 'health', target: sel('machine-health'), placement: 'bottom', titleKey: key('machine', 'health', 'title'), bodyKey: key('machine', 'health', 'body') },
    { id: 'tabs', target: sel('machine-tab-maintenance'), placement: 'bottom', titleKey: key('machine', 'tabs', 'title'), bodyKey: key('machine', 'tabs', 'body') },
    { id: 'more', target: sel('machine-more'), placement: 'bottom', titleKey: key('machine', 'more', 'title'), bodyKey: key('machine', 'more', 'body') },
    { id: 'asset', target: sel('asset-card'), placement: 'top', titleKey: key('machine', 'asset', 'title'), bodyKey: key('machine', 'asset', 'body') },
  ],
  // The platform console is English-only, so its tour text is written out here.
  leads: [
    { id: 'stats', target: sel('leads-stats'), placement: 'bottom', title: 'The numbers at a glance',
      body: 'Open leads, demos, follow-ups due, and two trial cards: "Trial requested" (asked for a trial but not started yet) and "Using trial now" (actually using it).' },
    { id: 'add', target: sel('leads-add'), placement: 'bottom', title: 'Add a lead',
      body: 'Paste a WhatsApp message or form submission ("Full name: …, Company name: …, Phone number: …") and the company, contact person, phone, WhatsApp number and more fill in by themselves.' },
    { id: 'board', target: sel('leads-board'), placement: 'top', title: 'The pipeline board',
      body: 'Drag a lead between columns as it moves forward. Open a lead to log a call, book a demo, and — once it is in "Trial requested" — press "They started the trial" when they actually begin.' },
  ],
};
