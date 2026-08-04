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

export function canCloseBreakdown(
  severity: 'critical' | 'high' | 'medium' | 'low' | null,
  rca: { status: string; rootCause: string } | null,
  isSupervisor: boolean,
): boolean {
  if (!isRCARequired(severity)) return true;
  if (isSupervisor && rca !== null) return true;
  return isRCAComplete(rca);
}
