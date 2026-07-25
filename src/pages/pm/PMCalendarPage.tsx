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
    if (event.scheduleId) {
      navigate(`/app/pm-schedules/${event.scheduleId}`);
    } else if (event.woId) {
      // Ad-hoc PM WOs aren't tied to a recurring schedule — send the user
      // straight to the Work Order itself.
      navigate(`/app/work-orders?woId=${event.woId}`);
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
