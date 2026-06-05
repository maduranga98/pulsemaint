import { useState } from 'react';
import type { WorkOrder, WOStatus } from '../../types/workOrder';
import { KANBAN_STATUSES, WO_STATUS_CONFIG } from '../../constants/woConfig';
import { WO_COPY } from '../../constants/copy';
import { WOCard } from './WOCard';
import { useUpdateWorkOrder } from '../../hooks/useUpdateWorkOrder';
import { useAuthStore } from '../../store/authStore';

interface WOKanbanBoardProps {
  workOrders: WorkOrder[];
  onSelectWO: (wo: WorkOrder) => void;
}

export function WOKanbanBoard({ workOrders, onSelectWO }: WOKanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<WOStatus | null>(null);

  const { updateStatus } = useUpdateWorkOrder();
  const userProfile = useAuthStore((s) => s.userProfile);
  const canDrag = userProfile?.role === 'supervisor' || userProfile?.role === 'admin';

  const byStatus: Record<WOStatus, WorkOrder[]> = {} as Record<WOStatus, WorkOrder[]>;
  for (const status of KANBAN_STATUSES) byStatus[status] = [];
  for (const wo of workOrders) {
    if (wo.status in byStatus) {
      byStatus[wo.status].push(wo);
    }
  }
  // Sort each column by SLA deadline (most urgent first)
  for (const status of KANBAN_STATUSES) {
    byStatus[status].sort((a, b) => {
      const aMs = a.slaDeadline?.toMillis() ?? Infinity;
      const bMs = b.slaDeadline?.toMillis() ?? Infinity;
      return aMs - bMs;
    });
  }

  function handleDragStart(e: React.DragEvent, woId: string) {
    if (!canDrag) return;
    setDraggingId(woId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(e: React.DragEvent, targetStatus: WOStatus) {
    e.preventDefault();
    if (!draggingId || !canDrag) return;
    const wo = workOrders.find((w) => w.id === draggingId);
    if (wo && wo.status !== targetStatus) {
      updateStatus(wo.id, targetStatus);
    }
    setDraggingId(null);
    setDragOverColumn(null);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[70vh]">
      {KANBAN_STATUSES.map((status) => {
        const config = WO_STATUS_CONFIG[status];
        const cards = byStatus[status];
        const isDropTarget = dragOverColumn === status;

        return (
          <div
            key={status}
            className={`flex-shrink-0 w-72 flex flex-col rounded-xl transition-colors ${
              isDropTarget ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOverColumn(status); }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
                <span className="text-xs font-semibold text-gray-700">{config.label}</span>
              </div>
              <span className="text-xs font-bold text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              {cards.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-6">{WO_COPY.kanbanEmptyColumn}</p>
              ) : (
                cards.map((wo) => (
                  <div
                    key={wo.id}
                    draggable={canDrag}
                    onDragStart={(e) => handleDragStart(e, wo.id)}
                    onDragEnd={() => setDraggingId(null)}
                    className={`${draggingId === wo.id ? 'opacity-50' : ''}`}
                  >
                    <WOCard workOrder={wo} onClick={onSelectWO} />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
