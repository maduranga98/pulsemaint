import type { TimeSegment } from '../types/workOrder';

export function computeWrenchTimePercent(segments: TimeSegment[]): number {
  const completed = segments.filter((s) => s.endAt !== null);
  if (completed.length === 0) return 0;
  let totalMs = 0;
  let workingMs = 0;
  for (const seg of completed) {
    const startMs = (seg.startAt as any)?.toMillis?.() ?? Number(seg.startAt);
    const endMs = (seg.endAt as any)?.toMillis?.() ?? Number(seg.endAt);
    const ms = Math.max(0, endMs - startMs);
    totalMs += ms;
    if (seg.state === 'working') workingMs += ms;
  }
  if (totalMs === 0) return 0;
  return Math.round((workingMs / totalMs) * 100);
}

export function getBadActors(
  breakdownCounts: Record<string, number>,
  totalMachines: number,
): string[] {
  const sorted = Object.entries(breakdownCounts).sort((a, b) => b[1] - a[1]);
  const top20pct = Math.max(1, Math.ceil(totalMachines * 0.2));
  return sorted.slice(0, top20pct).map(([id]) => id);
}

export function computePMComplianceStatus(rate: number): 'good' | 'warning' | 'poor' {
  if (rate >= 80) return 'good';
  if (rate >= 60) return 'warning';
  return 'poor';
}
