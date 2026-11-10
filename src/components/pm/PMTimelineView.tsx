import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '../../types/pm.types';
import { STATUS_HEX, startOfDay, timelineRows } from './pmViewData';

interface Props {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

const DAYS = 14;
const DAY = 24 * 3600 * 1000;

/** PM timeline (Gantt style): one row per PM over a two-week window, a bar on its planned day, a line for today. */
export function PMTimelineView({ events, onEventClick }: Props) {
  const { t } = useTranslation();
  const [start, setStart] = useState(() => new Date(startOfDay(new Date()).getTime() - 2 * DAY));
  const rows = useMemo(() => timelineRows(events, start, DAYS), [events, start]);
  const days = Array.from({ length: DAYS }, (_, i) => new Date(start.getTime() + i * DAY));
  const todayIndex = (startOfDay(new Date()).getTime() - startOfDay(start).getTime()) / DAY;
  const shift = (n: number) => setStart(new Date(start.getTime() + n * 7 * DAY));
  const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[DAYS - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="pm-gantt-card">
      <div className="pm-gantt-bar">
        <button type="button" className="pm-gantt-nav" onClick={() => shift(-1)} aria-label="←">←</button>
        <h3>{label}</h3>
        <button type="button" className="pm-gantt-nav" onClick={() => shift(1)} aria-label="→">→</button>
      </div>
      <div className="pm-gantt-scroll">
        <div className="pm-gantt" style={{ ['--days' as string]: DAYS }}>
          <div className="pm-gantt-head">
            <span className="pm-gantt-label" />
            <div className="pm-gantt-days">
              {days.map((d) => (
                <span key={d.toISOString()} className={d.getDay() === 0 || d.getDay() === 6 ? 'is-weekend' : ''}>
                  <small>{d.toLocaleDateString('en-US', { weekday: 'short' })}</small>
                  {d.getDate()}
                </span>
              ))}
            </div>
          </div>
          <div className="pm-gantt-body">
            {todayIndex >= 0 && todayIndex < DAYS && (
              <div className="pm-gantt-today" style={{ left: `calc(var(--label) + (100% - var(--label)) * ${(todayIndex + 0.5) / DAYS})` }}>
                <span>{t('common.dashboard.kpiScope.today', { defaultValue: 'TODAY' })}</span>
              </div>
            )}
            {rows.length === 0 && <p className="pm-col-empty">{t('common.pmSchedules.calendarView.noPmsScheduled')}</p>}
            {rows.map(({ event: e, left, width }, i) => (
              <div key={e.id} className="pm-gantt-row" style={{ ['--i' as string]: i }}>
                <span className="pm-gantt-label" title={`${e.machineName} · ${e.pmType ? t(`common.pmSchedules.types.${e.pmType}`) : e.title}`}>
                  <b>{e.machineName}</b>
                  <small>{e.pmType ? t(`common.pmSchedules.types.${e.pmType}`) : e.title}</small>
                </span>
                <div className="pm-gantt-track">
                  <button
                    type="button"
                    className="pm-gantt-barpill"
                    style={{ left: `${left * 100}%`, width: `${width * 100}%`, ['--bar' as string]: STATUS_HEX[e.operationalStatus ?? 'on_track'] }}
                    onClick={() => onEventClick?.(e)}
                    title={e.operationalStatus ? t(`common.pmSchedules.operationalStatuses.${e.operationalStatus}`) : undefined}
                  >
                    {e.woNumber ?? e.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
