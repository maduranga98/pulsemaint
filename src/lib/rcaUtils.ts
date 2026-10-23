export function isRCARequired(severity: 'critical' | 'high' | 'medium' | 'low' | null): boolean {
  if (!severity) return false;
  return ['critical', 'high', 'medium'].includes(severity);
}

export function isRCAComplete(
  rca: { status: string; rootCause: string } | null,
): boolean {
  if (!rca) return false;
  if (rca.status !== 'completed') return false;
  return rca.rootCause.trim().length > 0;
}

/**
 * Whether a breakdown ticket may be signed off and closed on its own.
 * Low-severity quick fixes (done by the technician, no work order) need no
 * RCA from whoever signs off — the technician's completion notes already feed
 * the AI suggestions. Every other severity needs a completed RCA with a root
 * cause, whoever signs off (a half-finished RCA no longer counts).
 */
export function canCloseBreakdown(
  severity: 'critical' | 'high' | 'medium' | 'low' | null,
  rca: { status: string; rootCause: string } | null,
): boolean {
  if (!isRCARequired(severity)) return true;
  return isRCAComplete(rca);
}
