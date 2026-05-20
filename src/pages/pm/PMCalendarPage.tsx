import { useNavigate } from 'react-router-dom';
import { usePMCalendarEvents } from '../../hooks/pm/usePMCalendarEvents';
import { useAuthStore } from '../../store/authStore';
import { PMCalendarView } from '../../components/pm/PMCalendarView';
import type { CalendarEvent } from '../../types/pm.types';

export default function PMCalendarPage() {
  const navigate = useNavigate();
  const company = useAuthStore((s) => s.company);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const { events, loading } = usePMCalendarEvents({
    companyId: company?.id || '',
    month: currentMonth,
    year: currentYear,
  });

  const handleEventClick = (event: CalendarEvent) => {
    navigate(`/app/pm-schedules/${event.scheduleId}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">PM Calendar</h1>
          <p className="text-sm text-gray-500">{events.length} events this period</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading calendar...</div>
      ) : (
        <PMCalendarView events={events} onEventClick={handleEventClick} />
      )}
    </div>
  );
}
