import { useEffect, useMemo, useState } from 'react';
import { Wrench, Clock, PauseCircle, ListTodo } from 'lucide-react';
import type { WorkOrder, WOStatus } from '../../types/workOrder';
import { useAuthStore } from '../../store/authStore';
import { useMyJobQueue } from '../../hooks/dashboard/useMyJobQueue';
import { WOTypeBadge } from '../../components/workorders/WOTypeBadge';
import { PriorityBadge } from '../../components/workorders/PriorityBadge';
import { WOStatusBadge } from '../../components/workorders/WOStatusBadge';
import { SLACountdownTimer } from '../../components/workorders/SLACountdownTimer';
import { TechnicianWOExecutionSheet } from '../../components/workorders/technician/TechnicianWOExecutionSheet';

const GROUPS: { key: string; label: string; icon: typeof Clock; statuses: WOStatus[] }[] = [
  { key: 'in_progress', label: 'In Progress', icon: Clock, statuses: ['IN_PROGRESS'] },
  { key: 'on_hold', label: 'On Hold', icon: PauseCircle, statuses: ['ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'] },
  { key: 'todo', label: 'To Do', icon: ListTodo, statuses: ['ASSIGNED', 'OPEN'] },
];

function WOCardItem({ wo, onClick }: { wo: WorkOrder; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4 text-left transition-colors hover:border-[#00C2FF]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-[#F0F4F8] font-[Sora]">{wo.woNumber}</p>
        <WOStatusBadge status={wo.status} size="sm" />
      </div>
      <p className="mt-1 text-sm text-[#F0F4F8]">{wo.machineName}</p>
      <p className="text-xs text-[#8BA3BF]">{wo.machineLocation}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <WOTypeBadge woType={wo.woType} size="sm" />
        <PriorityBadge priority={wo.priority} size="sm" />
      </div>
      <div className="mt-2">
        <SLACountdownTimer slaDeadline={wo.slaDeadline} status={wo.status} />
      </div>
    </button>
  );
}

export default function MyWorkOrdersPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const technicianId = userProfile?.id ?? '';
  const siteId = userProfile?.siteIds?.[0] ?? '';

  const { workOrders, loading, error } = useMyJobQueue(technicianId, siteId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Re-derive selected WO from the live list so the sheet updates in realtime
  // and auto-closes when the WO leaves the active queue.
  const selectedWO = useMemo(
    () => workOrders.find((w) => w.id === selectedId) ?? null,
    [workOrders, selectedId],
  );

  useEffect(() => {
    if (selectedId && !loading && !selectedWO) setSelectedId(null);
  }, [selectedId, selectedWO, loading]);

  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        items: workOrders.filter((w) => g.statuses.includes(w.status)),
      })),
    [workOrders],
  );

  return (
    <div className="min-h-full bg-[#0A1628] p-4 sm:p-6" style={{ fontFamily: 'Sora, sans-serif' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2">
          <Wrench className="h-6 w-6 text-[#00C2FF]" />
          <h1 className="text-xl font-bold text-[#F0F4F8]">My Work Orders</h1>
        </div>

        {loading && <p className="text-sm text-[#8BA3BF]">Loading your jobs…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && workOrders.length === 0 && (
          <div className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-10 text-center">
            <Wrench className="mx-auto mb-3 h-10 w-10 text-[#8BA3BF]" />
            <p className="text-sm font-medium text-[#F0F4F8]">No assigned work orders</p>
            <p className="mt-1 text-xs text-[#8BA3BF]">New jobs assigned to you will appear here.</p>
          </div>
        )}

        <div className="space-y-6">
          {grouped.map((g) =>
            g.items.length === 0 ? null : (
              <section key={g.key}>
                <div className="mb-2 flex items-center gap-2">
                  <g.icon className="h-4 w-4 text-[#8BA3BF]" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8BA3BF]">
                    {g.label} ({g.items.length})
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {g.items.map((wo) => (
                    <WOCardItem key={wo.id} wo={wo} onClick={() => setSelectedId(wo.id)} />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      </div>

      {selectedWO && (
        <TechnicianWOExecutionSheet workOrder={selectedWO} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
