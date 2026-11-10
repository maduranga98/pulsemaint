import { useEffect } from 'react';
import { gradientSpec, normalizeColor, type GradientKind } from '@/lib/chartGradient';

const NS = 'http://www.w3.org/2000/svg';
const BARS = '.recharts-bar-rectangle path, .recharts-bar-rectangle rect, path.recharts-rectangle';
const SLICES = '.recharts-pie-sector path, .recharts-radial-bar-sector, .recharts-sector';
const AREAS = 'path.recharts-area-area, path.recharts-radar-polygon';

/**
 * Charts are drawn by Recharts with one flat colour per series. This gives
 * every bar, slice and area a gradient of its own colour instead, without
 * touching each chart: it defines the gradients once and re-paints marks as
 * charts appear or change. Marks with an unreadable colour are left alone.
 */
export default function ChartGradients() {
  useEffect(() => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    const defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
    const made = new Set<string>();

    const gradientFor = (hex: string, kind: GradientKind): string => {
      const spec = gradientSpec(hex, kind);
      if (!made.has(spec.id)) {
        made.add(spec.id);
        const g = document.createElementNS(NS, 'linearGradient');
        g.setAttribute('id', spec.id);
        (['x1', 'y1', 'x2', 'y2'] as const).forEach((k) => g.setAttribute(k, spec[k]));
        spec.stops.forEach((s) => {
          const stop = document.createElementNS(NS, 'stop');
          stop.setAttribute('offset', s.offset);
          stop.setAttribute('stop-color', s.color);
          stop.setAttribute('stop-opacity', String(s.opacity));
          g.appendChild(stop);
        });
        defs.appendChild(g);
      }
      return `url(#${spec.id})`;
    };

    const paint = (el: Element, kindOf: (el: SVGGraphicsElement) => GradientKind) => {
      const raw = el.getAttribute('fill');
      const hex = normalizeColor(raw);
      if (!hex) return;
      let kind: GradientKind = 'v';
      try { kind = kindOf(el as SVGGraphicsElement); } catch { /* element not laid out yet */ }
      el.setAttribute('fill', gradientFor(hex, kind));
      el.setAttribute('fill-opacity', '1');
    };

    const scan = () => {
      document.querySelectorAll(BARS).forEach((el) =>
        paint(el, (g) => { const b = g.getBBox(); return b.width > b.height * 1.5 ? 'h' : 'v'; }));
      document.querySelectorAll(SLICES).forEach((el) => paint(el, () => 'd'));
      document.querySelectorAll(AREAS).forEach((el) => paint(el, () => 'area'));
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['fill'] });
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      svg.remove();
    };
  }, []);
  return null;
}
