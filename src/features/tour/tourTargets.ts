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
