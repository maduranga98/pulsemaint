import { useMemo } from 'react';

interface SegmentedGaugeProps {
  /** 0–100. */
  value: number;
  /** Base colour of the filled ticks; they brighten toward the end of the arc. */
  color?: string;
  /** Text in the middle; defaults to the rounded value with a % sign. */
  label?: string;
  className?: string;
}

const TICKS = 36;
const CX = 110;
const CY = 108;
const R_OUT = 96;
const R_IN = 72;

/** A half-circle gauge drawn as separate rounded ticks that light up one after another. */
export default function SegmentedGauge({ value, color = '#6D5DF6', label, className = '' }: SegmentedGaugeProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const lit = Math.round((pct / 100) * TICKS);
  const ticks = useMemo(
    () =>
      Array.from({ length: TICKS }, (_, i) => {
        const angle = Math.PI - (i / (TICKS - 1)) * Math.PI; // left (180°) to right (0°)
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return { i, x1: CX + R_IN * cos, y1: CY - R_IN * sin, x2: CX + R_OUT * cos, y2: CY - R_OUT * sin };
      }),
    [],
  );
  return (
    <div className={`seg-gauge ${className}`} role="img" aria-label={label ?? `${Math.round(pct)}%`}>
      <svg viewBox="0 0 220 122" className="seg-gauge-svg">
        {ticks.map((t) => (
          <line
            key={t.i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            className={t.i < lit ? 'seg-tick is-lit' : 'seg-tick'}
            style={{ ['--c' as string]: color, ['--i' as string]: t.i, ['--mix' as string]: `${Math.round((t.i / TICKS) * 70)}%` }}
          />
        ))}
      </svg>
      <span className="seg-gauge-label">{label ?? `${Math.round(pct)}%`}</span>
    </div>
  );
}
