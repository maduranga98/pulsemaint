import { useNavigate } from 'react-router-dom';
import { usePMCalendarEvents } from '../../hooks/pm/usePMCalendarEvents';
import { useAuthStore } from '../../store/authStore';
import { PMCalendarView } from '../../components/pm/PMCalendarView';
import type { CalendarEvent } from '../../types/pm.types';

export default function PMCalendarPage() {
  const navigate = useNavigate();
  const company = useAuthStore((s) => s.company);
  const userProfile = useAuthStore((s) => s.userProfile);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const { events, loading } = usePMCalendarEvents({
    companyId: company?.id || '',
    siteId: userProfile?.siteIds?.[0] || company?.id || '',
    month: currentMonth,
    year: currentYear,
  });

  const handleEventClick = (event: CalendarEvent) => {
    // Prefer jumping straight to the servicing Work Order — that's where the
    // real, live PM details (checklist, team, dates, completion) live.
    // Only fall back to the schedule detail page when no WO is linked yet.
    if (event.woId) {
      navigate(`/app/work-orders?woId=${event.woId}`);
    } else if (event.scheduleId) {
      navigate(`/app/pm-schedules/${event.scheduleId}`);
    }
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
