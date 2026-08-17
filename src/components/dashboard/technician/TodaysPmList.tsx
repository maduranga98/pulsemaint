import DashboardWidget from '../shared/DashboardWidget';
import { useMyJobQueue } from '../../../hooks/dashboard/useMyJobQueue';
import JobQueueItem from './JobQueueItem';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface TodaysPmListProps {
  technicianId: string;
  siteId: string;
  onSelect?: (woId: string) => void;
}

// Preventive Maintenance work orders assigned to me — the actual WO, not
// just the underlying pm_schedules record, so clicking one leads straight
// into the same execution flow as any other job (kept out of My Job Queue
// to avoid listing the same job twice).
export default function TodaysPmList({ technicianId, siteId, onSelect }: TodaysPmListProps) {
  const { t } = useTranslation();
  const { workOrders, loading, error } = useMyJobQueue(technicianId, siteId);
  const pmWOs = workOrders.filter(
    (wo) =>
      wo.woType === 'PREVENTIVE' &&
      !(wo.assigneeCompletions ?? []).some((c) => c.technicianId === technicianId),
  );

  return (
    <DashboardWidget title={t('common.widgets.todaysPmList.title')} loading={loading} error={error}>
      {pmWOs.length === 0 ? (
        <EmptyState message={t('common.widgets.todaysPmList.empty')} />
      ) : (
        <div className="space-y-2">
          {pmWOs.map((wo) => (
            <JobQueueItem key={wo.id} wo={wo} onClick={onSelect ? () => onSelect(wo.id) : undefined} />
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
