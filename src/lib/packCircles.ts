export interface PackInput { id: string; value: number }
export interface PackedCircle { id: string; value: number; x: number; y: number; r: number }

/**
 * Packs circles sized by value into a width × height box without overlap:
 * biggest first, each placed at the free spot nearest the centre (a spiral
 * search). A circle that cannot fit is shrunk a little and tried again.
 */
export function packCircles(items: PackInput[], width: number, height: number, maxRadius = Math.min(width, height) / 3.2, gap = 6): PackedCircle[] {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (!positive.length) return [];
  const top = positive[0].value;
  const placed: PackedCircle[] = [];
  let cap = Infinity;
  const cx = width / 2;
  const cy = height / 2;
  for (const item of positive) {
    let r = Math.min(cap, Math.max(14, Math.sqrt(item.value / top) * maxRadius));
    let spot: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < 12 && !spot; attempt++) {
      for (let t = 0; t < 2600 && !spot; t++) {
        const angle = t * 0.35;
        const dist = t * 0.22;
        const x = cx + Math.cos(angle) * dist * 1.4; // wider than tall, like the box
        const y = cy + Math.sin(angle) * dist;
        if (x - r < 0 || x + r > width || y - r < 0 || y + r > height) continue;
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + gap)) spot = { x, y };
      }
      if (!spot) r *= 0.9;
    }
    if (spot) {
      placed.push({ id: item.id, value: item.value, x: spot.x, y: spot.y, r });
      cap = r;
    }
  }
  return placed;
}
