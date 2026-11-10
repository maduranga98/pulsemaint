export type GradientKind = 'v' | 'h' | 'd' | 'area';

/** Reads "#rgb", "#rrggbb" or "rgb(r, g, b)" into a normalised "#rrggbb"; anything else (url(), var(), names) gives null. */
export function normalizeColor(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return '#' + [...m[1]].map((c) => c + c).join('');
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(v);
  if (m) return '#' + m[1];
  m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(v);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)));
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  return null;
}

/** Mixes a colour toward white by `amount` (0–1). */
export function lighten(hex: string, amount: number): string {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return '#' + n.map((c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0')).join('');
}

export interface GradientStop { offset: string; color: string; opacity: number }
export interface GradientSpec { id: string; x1: string; y1: string; x2: string; y2: string; stops: GradientStop[] }

/**
 * The gradient used for a chart mark of the given colour: bars fade from a
 * lighter top (or right end) to the base colour, slices run corner to corner,
 * and areas fade out downward so the line above them stays the strongest.
 */
export function gradientSpec(hex: string, kind: GradientKind): GradientSpec {
  const id = `fcg-${kind}-${hex.slice(1)}`;
  switch (kind) {
    case 'h':
      return { id, x1: '0', y1: '0', x2: '1', y2: '0', stops: [{ offset: '0', color: hex, opacity: 0.85 }, { offset: '1', color: lighten(hex, 0.35), opacity: 1 }] };
    case 'd':
      return { id, x1: '0', y1: '0', x2: '1', y2: '1', stops: [{ offset: '0', color: lighten(hex, 0.3), opacity: 1 }, { offset: '1', color: hex, opacity: 1 }] };
    case 'area':
      return { id, x1: '0', y1: '0', x2: '0', y2: '1', stops: [{ offset: '0', color: hex, opacity: 0.55 }, { offset: '1', color: hex, opacity: 0.03 }] };
    default:
      return { id, x1: '0', y1: '0', x2: '0', y2: '1', stops: [{ offset: '0', color: lighten(hex, 0.35), opacity: 1 }, { offset: '1', color: hex, opacity: 0.9 }] };
  }
}
