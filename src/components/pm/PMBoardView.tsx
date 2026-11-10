import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '../../types/pm.types';
import { PM_PRIORITY_CONFIG } from '../../constants/pmConfig';
import { STATUS_HEX, groupByStatus } from './pmViewData';

interface Props {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

/** PM board: one column per live status (overdue → due soon → in progress → on track → completed). */
export function PMBoardView({ events, onEventClick }: Props) {
  const { t } = useTranslation();
  const columns = groupByStatus(events);
  return (
    <div className="pm-board">
      {columns.map(({ status, items }, ci) => (
        <section key={status} className="pm-col" style={{ ['--col' as string]: STATUS_HEX[status], ['--ci' as string]: ci }}>
          <header className="pm-col-head">
            <span className="pm-col-dot" />
            <h3>{t(`common.pmSchedules.operationalStatuses.${status}`)}</h3>
            <span className="pm-col-count">{items.length}</span>
          </header>
          <div className="pm-col-body">
            {items.length === 0 && <p className="pm-col-empty">{t('common.pmSchedules.calendarView.noPmsScheduled')}</p>}
            {items.map((e, i) => (
              <button
                key={e.id}
                type="button"
                className="pm-card"
                style={{ ['--i' as string]: i, ['--prio' as string]: PM_PRIORITY_CONFIG[e.priority].color }}
                onClick={() => onEventClick?.(e)}
              >
                <span className="pm-card-type">{e.pmType ? t(`common.pmSchedules.types.${e.pmType}`) : e.title}</span>
                <b className="pm-card-machine">{e.machineName}</b>
                <span className="pm-card-meta">
                  {e.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                  {e.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {e.woNumber && ` · ${e.woNumber}`}
                </span>
                {e.technicianNames.length > 0 && (
                  <span className="pm-card-people">
                    {e.technicianNames.slice(0, 3).map((n) => (
                      <i key={n} title={n}>{n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</i>
                    ))}
                    {e.technicianNames.length > 3 && <i>+{e.technicianNames.length - 3}</i>}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
