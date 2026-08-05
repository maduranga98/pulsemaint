import { useState, useMemo } from 'react';
import type { CalendarEvent } from '../../types/pm.types';
import { PM_PRIORITY_CONFIG, PM_OPERATIONAL_STATUS_CONFIG, PM_TYPE_CONFIG } from '../../constants/pmConfig';

interface PMCalendarViewProps {
  events: CalendarEvent[];
  /** Only used from the day-detail panel's "Open Work Order" link — clicking
   *  a day or an event chip itself never navigates away or opens a popup. */
  onEventClick?: (event: CalendarEvent) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDueTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function PMCalendarView({ events, onEventClick }: PMCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('month');
  // Clicking a day selects it and shows its schedules in the panel below —
  // never a popup, never a page jump.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
            Week
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1 text-xs font-medium rounded-md ${view === 'month' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            Month
          </button>
        </div>
      </div>

      {view === 'month' ? (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {DAYS.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-500">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {calendarDays.map((day, idx) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              const isSelected =
                !!day &&
                !!selectedDate &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!day}
                  onClick={() => day && setSelectedDate(new Date(year, month, day))}
                  className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-100 p-1 text-left ${
                    isSelected ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : isToday ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-medium block"
                            style={{
                              backgroundColor: PM_PRIORITY_CONFIG[event.priority].bgClass.replace('bg-', '').replace('100', '50'),
                              color: PM_PRIORITY_CONFIG[event.priority].textClass.replace('text-', '').replace('700', '800'),
                              borderLeft: `3px solid ${PM_PRIORITY_CONFIG[event.priority].color}`,
                            }}
                            title={`${event.title}${event.operationalStatus ? ` · ${PM_OPERATIONAL_STATUS_CONFIG[event.operationalStatus].label}` : ''}`}
                          >
                            <span className="flex items-center gap-1 opacity-75 truncate">
                              {event.operationalStatus && (
                                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${PM_OPERATIONAL_STATUS_CONFIG[event.operationalStatus].dotClass}`} />
                              )}
                              <span className="truncate">{formatDueTime(event.date)}</span>
                            </span>
                            <span className="block font-semibold whitespace-normal break-words leading-tight">
                              {PM_TYPE_CONFIG[event.pmType]?.label ?? event.title}
                            </span>
                            {event.woNumber && (
                              <span className="block truncate opacity-75">{event.woNumber}</span>
                            )}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {weekDays.map((date) => {
            const dayEvents = getEventsForDate(date);
            const isToday =
              date.getDate() === new Date().getDate() &&
              date.getMonth() === new Date().getMonth() &&
              date.getFullYear() === new Date().getFullYear();

            return (
              <div key={date.toISOString()} className={`p-3 ${isToday ? 'bg-blue-50' : ''}`}>
                <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="space-y-1">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="text-sm px-3 py-2 rounded-lg font-medium"
                      style={{
                        backgroundColor: PM_PRIORITY_CONFIG[event.priority].bgClass.replace('bg-', '').replace('100', '50'),
                        color: PM_PRIORITY_CONFIG[event.priority].textClass.replace('text-', '').replace('700', '800'),
                        borderLeft: `3px solid ${PM_PRIORITY_CONFIG[event.priority].color}`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          {event.operationalStatus && (
                            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${PM_OPERATIONAL_STATUS_CONFIG[event.operationalStatus].dotClass}`} />
                          )}
                          <span className="opacity-75">{formatDueTime(event.date)} · </span>
                          {event.woNumber && <span className="font-semibold">{event.woNumber} · </span>}
                          {PM_TYPE_CONFIG[event.pmType]?.label ?? event.title}
                        </span>
                        <span className="text-xs opacity-75">
                          {event.operationalStatus ? PM_OPERATIONAL_STATUS_CONFIG[event.operationalStatus].label : event.machineName}
                        </span>
                      </div>
                    </div>
                  ))}
                  {dayEvents.length === 0 && (
                    <p className="text-xs text-gray-300 py-1">No PMs scheduled</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDate && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          {getEventsForDate(selectedDate).length === 0 ? (
            <p className="text-sm text-gray-400">No PMs scheduled.</p>
          ) : (
            <div className="space-y-2">
              {getEventsForDate(selectedDate).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: PM_PRIORITY_CONFIG[event.priority].bgClass.replace('bg-', '').replace('100', '50'),
                    borderLeft: `3px solid ${PM_PRIORITY_CONFIG[event.priority].color}`,
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {formatDueTime(event.date)} · {PM_TYPE_CONFIG[event.pmType]?.label ?? event.title}
                      {event.woNumber && ` · ${event.woNumber}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {event.machineName}
                      {event.operationalStatus && ` · ${PM_OPERATIONAL_STATUS_CONFIG[event.operationalStatus].label}`}
                      {event.technicianNames.length > 0 && ` · ${event.technicianNames.join(', ')}`}
                    </p>
                  </div>
                  {onEventClick && (
                    <button
                      type="button"
                      onClick={() => onEventClick(event)}
                      className="flex-shrink-0 text-xs font-medium text-blue-600 hover:underline"
                    >
                      {event.woId ? 'Open Work Order' : 'Open Schedule'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
