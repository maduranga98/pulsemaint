import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePMCalendarEvents } from '../../hooks/pm/usePMCalendarEvents';
import { useSchedulableJobs } from '../../hooks/pm/useSchedulableJobs';
import { useAuthStore } from '../../store/authStore';
import { PMCalendarView } from '../../components/pm/PMCalendarView';
import { SchedulerBoard } from '../../components/pm/SchedulerBoard';
import { TechnicianAssignmentModal } from '../../components/pm/TechnicianAssignmentModal';
import type { CalendarEvent } from '../../types/pm.types';
import type { SchedulableJob } from '../../lib/pm/schedulerConflict';

type ViewMode = 'calendar' | 'scheduler';

export default function PMCalendarPage() {
  const navigate = useNavigate();
  const company = useAuthStore((s) => s.company);
  const companyId = company?.id || '';
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [assignJob, setAssignJob] = useState<SchedulableJob | null>(null);

  const { events, loading } = usePMCalendarEvents({
    companyId,
    month: currentMonth,
    year: currentYear,
  });
  const { jobs } = useSchedulableJobs(companyId);

  // Clicking an event opens the technician-assignment flow (with conflict
  // detection). The matching SchedulableJob carries the ids + estimated hours.
  const handleEventClick = (event: CalendarEvent) => {
    const jobId = event.scheduleId || event.id.replace(/^wo-/, '');
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      setAssignJob(job);
    } else if (event.scheduleId) {
      navigate(`/app/pm-schedules/${event.scheduleId}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">PM Calendar</h1>
          <p className="text-sm text-gray-500">
            {viewMode === 'calendar'
              ? `${events.length} events this period`
              : 'Drag jobs between technicians to reassign'}
          </p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              viewMode === 'calendar' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setViewMode('scheduler')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              viewMode === 'scheduler' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            Scheduler
          </button>
        </div>
      </div>

      {viewMode === 'scheduler' ? (
        <SchedulerBoard />
      ) : loading ? (
        <div className="p-8 text-center text-gray-400">Loading calendar...</div>
      ) : (
        <PMCalendarView events={events} onEventClick={handleEventClick} />
      )}

      {assignJob && (
        <TechnicianAssignmentModal
          job={assignJob}
          onClose={() => setAssignJob(null)}
          onOpenRecord={
            assignJob.source === 'pm_schedule'
              ? () => navigate(`/app/pm-schedules/${assignJob.id}`)
              : () => navigate('/app/work-orders')
          }
        />
      )}
    </div>
  );
}
