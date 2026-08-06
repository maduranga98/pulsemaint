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

// Every WO assigned to the technician that isn't yet complete — shown as a
// flat list with no today/week/all filter, so nothing assigned to them is
// ever hidden. useMyJobQueue already excludes WOs whose overall status is
// terminal, but on a team WO the shared status can still read active while
// this technician has already submitted their own completion (see
// assigneeCompletions) — those are done from their point of view and are
// filtered out here too.
export default function JobQueueList({ technicianId, siteId, onSelect }: JobQueueListProps) {
  const { workOrders, loading, error } = useMyJobQueue(technicianId, siteId);
  // Preventive WOs get their own "Assigned PM Schedules" widget — showing
  // them here too would list the same job twice.
  const notCompletedByMe = workOrders.filter(
    (wo) =>
      wo.woType !== 'PREVENTIVE' &&
      !(wo.assigneeCompletions ?? []).some((c) => c.technicianId === technicianId),
  );

  return (
    <DashboardWidget title="My Job Queue" loading={loading} error={error}>
      {notCompletedByMe.length === 0 ? (
        <EmptyState message="No jobs in queue" />
      ) : (
        <div className="space-y-2">
          {notCompletedByMe.map((wo) => (
            <JobQueueItem key={wo.id} wo={wo} onClick={onSelect ? () => onSelect(wo) : undefined} />
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
