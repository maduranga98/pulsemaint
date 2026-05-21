import { useState } from 'react';
import DashboardWidget from '../shared/DashboardWidget';
import { useMyJobQueue } from '../../../hooks/dashboard/useMyJobQueue';
import JobQueueItem from './JobQueueItem';
import EmptyState from '../shared/EmptyState';
import type { WorkOrder } from '../../../types';

interface JobQueueListProps {
  technicianId: string;
  siteId: string;
}

export default function JobQueueList({ technicianId, siteId }: JobQueueListProps) {
  const [filter, setFilter] = useState<'today' | 'week' | 'all'>('all');
  const { workOrders, loading, error } = useMyJobQueue(technicianId, siteId);

  const filtered = workOrders.filter((wo: WorkOrder) => {
    if (filter === 'all') return true;
    const due = wo.dueDate?.toDate ? wo.dueDate.toDate() : new Date(wo.dueDate as any);
    const daysUntil = Math.ceil((due.getTime() - Date.now()) / 86400000);
    if (filter === 'today') return daysUntil <= 1;
    if (filter === 'week') return daysUntil <= 7;
    return true;
  });

  return (
    <DashboardWidget
      title="My Job Queue"
      loading={loading}
      error={error}
      action={
        <div className="flex bg-[#0A1628] rounded-md border border-[#1E3A5F]">
          {([
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'Week' },
            { key: 'all', label: 'All' },
          ] as { key: typeof filter; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-sm ${
                filter === f.key ? 'bg-[#1A56DB] text-white' : 'text-[#8BA3BF]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {filtered.length === 0 ? (
        <EmptyState message="No jobs in queue" />
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filtered.map((wo) => (
            <JobQueueItem key={wo.id} wo={wo} />
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
