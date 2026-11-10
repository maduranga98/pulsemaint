import { useMemo } from 'react';
import { DAY_MINUTES, layoutRibbon, type RibbonShift } from '../../lib/shiftRibbon';

interface ShiftRibbonProps {
  shifts: RibbonShift[];
  /** Slim version for a single plan card: no hour labels. */
  compact?: boolean;
}

const TICKS = [0, 6, 12, 18, 24];

/** A 24-hour day with each shift drawn as a coloured bar (night shifts wrap past midnight). */
export default function ShiftRibbon({ shifts, compact = false }: ShiftRibbonProps) {
  const { segments, lanes } = useMemo(() => layoutRibbon(shifts), [shifts]);
  return (
    <div className={`shift-ribbon ${compact ? 'is-compact' : ''}`}>
      <div className="shift-ribbon-track" style={{ ['--lanes' as string]: lanes }}>
        {TICKS.slice(1, -1).map((h) => (
          <i key={h} className="shift-ribbon-tick" style={{ left: `${(h * 60 * 100) / DAY_MINUTES}%` }} />
        ))}
        {segments.map((seg) => {
          const width = ((seg.to - seg.from) * 100) / DAY_MINUTES;
          return (
            <span
              key={seg.key}
              className={`shift-ribbon-bar ${seg.preview ? 'is-preview' : ''}`}
              title={seg.name}
              style={{ left: `${(seg.from * 100) / DAY_MINUTES}%`, width: `${width}%`, top: `calc(${seg.lane} * (100% / var(--lanes)))`, ['--bar' as string]: seg.color }}
            >
              {!compact && width > 14 ? seg.name : ''}
            </span>
          );
        })}
      </div>
      {!compact && (
        <div className="shift-ribbon-hours" aria-hidden="true">
          {TICKS.map((h) => (
            <span key={h} style={{ left: `${(h * 100) / 24}%` }}>{String(h).padStart(2, '0')}</span>
          ))}
        </div>
      )}
    </div>
  );
}
