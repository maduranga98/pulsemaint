import type { TourStepDef } from './tourDefs';

/** Is this element really on screen for the user (not hidden, not in a closed mobile drawer, not zero-sized)? */
export function isTargetVisible(el: Element, viewportWidth: number = window.innerWidth): boolean {
  if (el.getClientRects().length === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  return r.right > 0 && r.left < viewportWidth; // e.g. the sidebar slid off-screen on a phone
}

/** The stops of a tour whose target is currently visible, in order. "body" (centred card) is always available. */
export function visibleSteps(defs: TourStepDef[], doc: Document = document): TourStepDef[] {
  return defs.filter((d) => {
    if (d.target === 'body') return true;
    const el = doc.querySelector(d.target);
    return !!el && isTargetVisible(el);
  });
}

/**
 * On the phone launcher, one stop per app icon — each icon carries its own
 * `data-tour-app` / `data-tour-title` / `data-tour-body` — placed right after the
 * "search" stop and before the general "your apps" stop. Returns the steps
 * unchanged anywhere else (no icons on screen).
 */
export function withLauncherAppSteps(steps: TourStepDef[], doc: Document = document): TourStepDef[] {
  const at = steps.findIndex((s) => s.id === 'launcher_search');
  const icons = Array.from(doc.querySelectorAll<HTMLElement>('[data-tour-app]')).filter((el) => isTargetVisible(el, doc.defaultView?.innerWidth ?? Number.MAX_SAFE_INTEGER));
  if (at < 0 || icons.length === 0) return steps;
  const appSteps: TourStepDef[] = icons.map((el) => ({
    id: `launcher_app_${el.dataset.tourApp}`,
    target: `[data-tour-app="${el.dataset.tourApp}"]`,
    title: el.dataset.tourTitle ?? '',
    body: el.dataset.tourBody ?? '',
    placement: 'bottom',
  }));
  return [...steps.slice(0, at + 1), ...appSteps, ...steps.slice(at + 1)];
}
