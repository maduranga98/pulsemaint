import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePMSchedules } from '../../hooks/pm/usePMSchedules';
import { useAuthStore } from '../../store/authStore';
import { usePMStore } from '../../store/pm.store';
import { useState } from 'react';
import { PMCalendarView } from '../../components/pm/PMCalendarView';
import { PMBoardView } from '../../components/pm/PMBoardView';
import { PMTimelineView } from '../../components/pm/PMTimelineView';
import { usePMCalendarEvents } from '../../hooks/pm/usePMCalendarEvents';
import type { CalendarEvent } from '../../types/pm.types';
import { PageHeader, Button } from '../../components/ui';
import { useRecordPlantMatcher } from '../../hooks/useRecordPlantMatcher';

export default function PMSchedulesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<'calendar' | 'board' | 'timeline'>('calendar');
  const company = useAuthStore((s) => s.company);
  const userProfile = useAuthStore((s) => s.userProfile);
  const isSupervisor = useAuthStore((s) => s.isSupervisor || s.isAdmin);

  const filters = usePMStore((s) => s.filters);

  // Falls back to the machine's plant for records predating plant stamping.
  const inScopedPlant = useRecordPlantMatcher();
  const { schedules: fetchedSchedules } = usePMSchedules({ companyId: company?.id || '', filters });
  // Plant-scoped roles only see PM schedules for their own registered plant;
  // supervisor (the only department-scoped role that reaches this page) is
  // further scoped to their own department within that plant.
  const scheduleCount = fetchedSchedules.filter((s) => inScopedPlant(s)).length;

  const { events: calendarEvents, loading: calendarLoading } = usePMCalendarEvents({
    companyId: company?.id || '',
    siteId: userProfile?.siteIds?.[0] || company?.id || '',
  });

  const handleCalendarEventClick = (event: CalendarEvent) => {
    // Prefer jumping straight to the servicing Work Order — that's where the
    // real, live PM details (checklist, team, dates, completion) live. Only
    // fall back to the schedule detail page when no WO is linked yet.
    if (event.woId) {
      navigate(`/app/work-orders?woId=${event.woId}`);
    } else if (event.scheduleId) {
      navigate(`/app/pm-schedules/${event.scheduleId}`);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('common.pmSchedules.pageTitle')}
        description={t('common.pmSchedules.count', { count: scheduleCount })}
        actions={
          isSupervisor && (
            <Button
              variant="primary"
              onClick={() => navigate('/app/work-orders?create=1&woType=PREVENTIVE')}
            >
              {t('common.pmSchedules.newPmWorkOrder')}
            </Button>
          )
        }
      />

      <div className="space-y-4">
        <div role="tablist" className="pm-views">
          {(['calendar', 'board', 'timeline'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={view === v ? 'is-on' : ''}>
              {t(`common.pmSchedules.views.${v}`)}
            </button>
          ))}
        </div>
        {calendarLoading ? (
          <div className="p-8 text-center text-gray-400">{t('common.pmSchedules.loadingCalendar')}</div>
        ) : view === 'board' ? (
          <PMBoardView events={calendarEvents} onEventClick={handleCalendarEventClick} />
        ) : view === 'timeline' ? (
          <PMTimelineView events={calendarEvents} onEventClick={handleCalendarEventClick} />
        ) : (
          <PMCalendarView events={calendarEvents} onEventClick={handleCalendarEventClick} />
        )}
      </div>
    </div>
  );
}
