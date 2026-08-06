import DashboardWidget from '../shared/DashboardWidget';
import { useMyJobQueue } from '../../../hooks/dashboard/useMyJobQueue';
import JobQueueItem from './JobQueueItem';
import EmptyState from '../shared/EmptyState';
import type { WorkOrder } from '../../../types';

interface JobQueueListProps {
  technicianId: string;
  siteId: string;
  onSelect?: (wo: WorkOrder) => void;
}

// Every WO assigned to the technician that isn't yet complete (useMyJobQueue
// already filters to ACTIVE_STATUSES) — shown as a flat list with no
// today/week/all filter, so nothing assigned to them is ever hidden.
export default function JobQueueList({ technicianId, siteId, onSelect }: JobQueueListProps) {
  const { workOrders, loading, error } = useMyJobQueue(technicianId, siteId);

  return (
    <DashboardWidget title="My Job Queue" loading={loading} error={error}>
      {workOrders.length === 0 ? (
        <EmptyState message="No jobs in queue" />
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {workOrders.map((wo) => (
            <JobQueueItem key={wo.id} wo={wo} onClick={onSelect ? () => onSelect(wo) : undefined} />
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
