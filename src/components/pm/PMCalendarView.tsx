import { useState, useMemo } from 'react';
import type { CalendarEvent } from '../../types/pm.types';
import { PM_PRIORITY_CONFIG } from '../../constants/pmConfig';

interface PMCalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PMCalendarView({ events, onEventClick }: PMCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('month');

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

              return (
                <div
                  key={idx}
                  className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-100 p-1 ${
                    isToday ? 'bg-blue-50' : ''
                  }`}
                >
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <button
                            key={event.id}
                            onClick={() => onEventClick?.(event)}
                            className="w-full text-left text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-medium truncate"
                            style={{
                              backgroundColor: PM_PRIORITY_CONFIG[event.priority].bgClass.replace('bg-', '').replace('100', '50'),
                              color: PM_PRIORITY_CONFIG[event.priority].textClass.replace('text-', '').replace('700', '800'),
                              borderLeft: `3px solid ${PM_PRIORITY_CONFIG[event.priority].color}`,
                            }}
                          >
                            {event.title}
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
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
                    <button
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className="w-full text-left text-sm px-3 py-2 rounded-lg font-medium"
                      style={{
                        backgroundColor: PM_PRIORITY_CONFIG[event.priority].bgClass.replace('bg-', '').replace('100', '50'),
                        color: PM_PRIORITY_CONFIG[event.priority].textClass.replace('text-', '').replace('700', '800'),
                        borderLeft: `3px solid ${PM_PRIORITY_CONFIG[event.priority].color}`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{event.title}</span>
                        <span className="text-xs opacity-75">{event.machineName}</span>
                      </div>
                    </button>
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
    </div>
  );
}
