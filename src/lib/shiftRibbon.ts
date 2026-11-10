export interface RibbonShift {
  id: string;
  name: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  color: string;
  preview?: boolean;
}

export interface RibbonSegment {
  key: string;
  shiftId: string;
  name: string;
  color: string;
  preview: boolean;
  /** Minutes from midnight, 0–1440. */
  from: number;
  to: number;
  lane: number;
}

export const DAY_MINUTES = 24 * 60;

export function toMinutes(time: string | undefined | null): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return Math.min(DAY_MINUTES, h * 60 + min);
}

/**
 * Lays shifts out on a 24-hour ribbon. A shift that ends at or before its start
 * runs overnight and is drawn in two pieces (to midnight, and from midnight);
 * pieces that overlap in time are stacked on separate lanes. Shifts with an
 * unreadable time are left out.
 */
export function layoutRibbon(shifts: RibbonShift[]): { segments: RibbonSegment[]; lanes: number } {
  const pieces: Omit<RibbonSegment, 'lane'>[] = [];
  for (const s of shifts) {
    const from = toMinutes(s.start);
    const to = toMinutes(s.end);
    if (from === null || to === null || from === to) continue;
    const base = { shiftId: s.id, name: s.name, color: s.color, preview: !!s.preview };
    if (to > from) pieces.push({ ...base, key: `${s.id}:0`, from, to });
    else {
      pieces.push({ ...base, key: `${s.id}:a`, from, to: DAY_MINUTES });
      if (to > 0) pieces.push({ ...base, key: `${s.id}:b`, from: 0, to });
    }
  }
  pieces.sort((a, b) => a.from - b.from || a.to - b.to);
  const laneEnds: number[] = [];
  const segments = pieces.map((p) => {
    let lane = laneEnds.findIndex((end) => end <= p.from);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = p.to;
    return { ...p, lane };
  });
  return { segments, lanes: Math.max(1, laneEnds.length) };
}
