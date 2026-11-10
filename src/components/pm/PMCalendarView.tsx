import { useState, useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEvent, PMOperationalStatus } from '../../types/pm.types';
import { PM_PRIORITY_CONFIG, PM_OPERATIONAL_STATUS_CONFIG } from '../../constants/pmConfig';

interface PMCalendarViewProps {
  events: CalendarEvent[];
  /** Only used from the day-detail panel's "Open Work Order" link — clicking
   *  a day or an event chip itself never navigates away or opens a popup. */
  onEventClick?: (event: CalendarEvent) => void;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Translucent priority-tinted chip that reads on both light and dark surfaces
 *  (the old code fed Tailwind class names like `red-50` to CSS, which is
 *  invalid, so chips rendered with no background or colour). */
function eventChipStyle(priority: CalendarEvent['priority'], withText = true): CSSProperties {
  const color = PM_PRIORITY_CONFIG[priority].color;
  return {
    backgroundColor: `${color}26`,
    borderLeft: `3px solid ${color}`,
    ...(withText ? { color } : {}),
  };
}

function formatDueTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function PMCalendarView({ events, onEventClick }: PMCalendarViewProps) {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('month');
  // Clicking a day selects it and shows its schedules in the panel beside the
  // calendar — never a popup, never a page jump. Today is selected to start with.
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const totalDays = lastDayOfMonth.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);

    return days;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const getEventsForDay = (day: number) => {
    return events.filter((e) => {
      const d = e.date;
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((e) => {
      const d = e.date;
      return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
    });
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const selectedEvents = getEventsForDate(selectedDate);

  // Compliance for the month on screen: of the PMs that have fallen due so far
  // (paused ones don't count), how many are completed.
  const compliance = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const due = events.filter(
      (e) => e.date.getMonth() === month && e.date.getFullYear() === year && e.date <= endOfToday && e.operationalStatus !== 'paused',
    );
    const done = due.filter((e) => e.operationalStatus === 'completed' || e.status === 'completed').length;
    return { due: due.length, done, percent: due.length ? Math.round((done / due.length) * 100) : null };
  }, [events, month, year]);

  const legend = useMemo(() => {
    const seen = new Set<PMOperationalStatus>();
    events.forEach((e) => {
      if (e.operationalStatus && e.date.getMonth() === month && e.date.getFullYear() === year) seen.add(e.operationalStatus);
    });
    return (Object.keys(PM_OPERATIONAL_STATUS_CONFIG) as PMOperationalStatus[]).filter((k) => seen.has(k));
  }, [events, month, year]);

  const dot = (event: CalendarEvent, onAccent: boolean) =>
    event.operationalStatus ? (
      <span
        key={event.id}
        className={`h-1.5 w-1.5 rounded-full ${onAccent ? 'bg-white' : PM_OPERATIONAL_STATUS_CONFIG[event.operationalStatus].dotClass}`}
      />
    ) : (
      <span
        key={event.id}
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: onAccent ? '#FFFFFF' : PM_PRIORITY_CONFIG[event.priority].color }}
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={view === 'month' ? prevMonth : prevWeek} className="p-1.5 hover:bg-gray-100 rounded-lg">
            ←
          </button>
          <h2 className="text-lg font-semibold text-gray-900">{monthLabel}</h2>
          <button onClick={view === 'month' ? nextMonth : nextWeek} className="p-1.5 hover:bg-gray-100 rounded-lg">
            →
          </button>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1 text-xs font-medium rounded-md ${view === 'week' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            {t('common.pmSchedules.calendarView.week')}
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 text-xs font-medium rounded-md ${view === 'month' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            {t('common.pmSchedules.calendarView.month')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {view === 'month' ? (
          <div className="min-w-0 bg-white rounded-2xl border border-gray-200 p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1">
              {DAY_KEYS.map((d) => (
                <div key={d} className="py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {t(`common.pmSchedules.calendarView.days.${d}`)}
                </div>
              ))}
            </div>
            {/* Re-keyed per month so the days slide in when the month changes. */}
            <div key={`${year}-${month}`} className="pm-month grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (!day) return <span key={idx} />;
                const date = new Date(year, month, day);
                const dayEvents = getEventsForDay(day);
                const isToday = isSameDay(date, today);
                const isSelected = isSameDay(date, selectedDate);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    aria-pressed={isSelected}
                    title={dayEvents.map((e) => e.title).join(', ') || undefined}
                    className={`pm-day relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition-colors sm:h-16 ${
                      isSelected
                        ? 'pm-day-selected bg-blue-600 text-white shadow-md'
                        : isToday
                          ? 'text-blue-600 ring-2 ring-inset ring-blue-500 hover:bg-gray-100'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{day}</span>
                    <span className="flex h-1.5 items-center gap-0.5">
                      {dayEvents.slice(0, 4).map((event) => dot(event, isSelected))}
                      {dayEvents.length > 4 && (
                        <span className={`text-[9px] leading-none ${isSelected ? 'text-white' : 'text-gray-500'}`}>+{dayEvents.length - 4}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {legend.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
                {legend.map((status) => (
                  <span key={status} className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${PM_OPERATIONAL_STATUS_CONFIG[status].dotClass}`} />
                    {t(`common.pmSchedules.operationalStatuses.${status}`)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="min-w-0 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {weekDays.map((date) => {
              const dayEvents = getEventsForDate(date);
              const isToday = isSameDay(date, today);
              const isSelected = isSameDay(date, selectedDate);

              return (
                <div
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`cursor-pointer p-3 transition-colors ${isSelected ? 'bg-blue-100' : isToday ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="text-sm px-3 py-2 rounded-lg font-medium"
                        style={eventChipStyle(event.priority)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            {event.operationalStatus && (
                              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${PM_OPERATIONAL_STATUS_CONFIG[event.operationalStatus].dotClass}`} />
                            )}
                            <span className="opacity-75">{formatDueTime(event.date)} · </span>
                            {event.woNumber && <span className="font-semibold">{event.woNumber} · </span>}
                            {event.pmType ? t(`common.pmSchedules.types.${event.pmType}`) : event.title}
                          </span>
                          <span className="text-xs opacity-75">
                            {event.operationalStatus ? t(`common.pmSchedules.operationalStatuses.${event.operationalStatus}`) : event.machineName}
                          </span>
                        </div>
                      </div>
                    ))}
                    {dayEvents.length === 0 && (
                      <p className="text-xs text-gray-300 py-1">{t('common.pmSchedules.calendarView.noPmsScheduled')}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="min-w-0 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
            <svg viewBox="0 0 36 36" className="h-[72px] w-[72px] shrink-0" role="img" aria-label={t('common.pmSchedules.detail.complianceRate')}>
              <circle className="pm-ring-track" cx="18" cy="18" r="15.915" fill="none" strokeWidth="3.4" />
              <circle
                className="pm-ring-value"
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeDasharray={`${compliance.percent ?? 0} 100`}
                transform="rotate(-90 18 18)"
              />
              <text x="18" y="21" textAnchor="middle" className="pm-ring-text">
                {compliance.percent === null ? '–' : `${compliance.percent}%`}
              </text>
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t('common.pmSchedules.detail.complianceRate')}</p>
              <p className="text-xs text-gray-500">
                {t('common.pmSchedules.calendarView.doneOfDue', { done: compliance.done, total: compliance.due })}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="mb-3 text-xs text-gray-500">
              {selectedEvents.length === 0
                ? t('common.pmSchedules.calendarView.noPmsScheduledPeriod')
                : t('common.pmSchedules.calendarView.pmCount', { count: selectedEvents.length })}
            </p>
            {selectedEvents.length > 0 && (
              <div key={selectedDate.toDateString()} className="pm-day-list space-y-2">
                {selectedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                    style={eventChipStyle(event.priority, false)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {formatDueTime(event.date)} · {event.pmType ? t(`common.pmSchedules.types.${event.pmType}`) : event.title}
                        {event.woNumber && ` · ${event.woNumber}`}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {event.machineName}
                        {event.operationalStatus && ` · ${t(`common.pmSchedules.operationalStatuses.${event.operationalStatus}`)}`}
                        {event.technicianNames.length > 0 && ` · ${event.technicianNames.join(', ')}`}
                      </p>
                    </div>
                    {onEventClick && (
                      <button
                        type="button"
                        onClick={() => onEventClick(event)}
                        className="flex-shrink-0 text-xs font-medium text-blue-600 hover:underline"
                      >
                        {event.woId ? t('common.pmSchedules.calendarView.openWorkOrder') : t('common.pmSchedules.calendarView.openSchedule')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
