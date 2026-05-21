import { useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useActiveBreakdowns } from '../../../hooks/dashboard/useActiveBreakdowns';
import type { BreakdownKanbanCard as CardType } from '../../../types/analytics.types';
import BreakdownKanbanLane from './BreakdownKanbanLane';
import BreakdownKanbanCard from './BreakdownKanbanCard';
import DashboardWidget from '../shared/DashboardWidget';

interface LaneDef {
  id: string;
  title: string;
  states: string[];
  borderColor: string;
}

const LANES: LaneDef[] = [
  { id: 'reported', title: 'REPORTED', states: ['reported'], borderColor: '#EF4444' },
  { id: 'in_triage', title: 'IN TRIAGE', states: ['acknowledged', 'triage_in_progress'], borderColor: '#F59E0B' },
  { id: 'assigned', title: 'ASSIGNED', states: ['assigned', 'en_route'], borderColor: '#1A56DB' },
  { id: 'in_progress', title: 'IN PROGRESS', states: ['repair_in_progress'], borderColor: '#00C2FF' },
  { id: 'on_hold', title: 'ON HOLD', states: ['on_hold_parts', 'on_hold_approval'], borderColor: '#6B7280' },
  { id: 'resolved', title: 'RESOLVED', states: ['resolved'], borderColor: '#10B981' },
];

function toKanbanCard(b: any): CardType {
  const reportedAt = b.reportedAt?.toDate?.() ?? new Date(b.reportedAt);
  const slaDeadline = b.slaDeadline?.toDate?.() ?? (b.slaDeadline ? new Date(b.slaDeadline) : null);
  const elapsedMinutes = Math.floor((Date.now() - reportedAt.getTime()) / 60000);
  const slaMinutesRemaining = slaDeadline
    ? Math.floor((slaDeadline.getTime() - Date.now()) / 60000)
    : null;

  return {
    id: b.id,
    ticketNumber: b.ticketNumber,
    machineName: b.machineName,
    machineLocation: b.machineLocation,
    severity: b.severity,
    breakdownType: b.type,
    state: b.status,
    assignedTechnicianId: b.assignedTechnicianIds?.[0] ?? null,
    assignedTechnicianName: b.assignedTechnicianNames?.[0] ?? null,
    reportedAt,
    elapsedMinutes,
    slaDeadline,
    slaMinutesRemaining,
    slaBreach: b.slaBreached ?? false,
  };
}

interface BreakdownKanbanBoardProps {
  companyId: string;
}

export default function BreakdownKanbanBoard({ companyId }: BreakdownKanbanBoardProps) {
  const { breakdowns, loading, error } = useActiveBreakdowns(companyId);
  const [cards, setCards] = useState<CardType[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync cards from Firestore
  useMemo(() => {
    setCards(breakdowns.map(toKanbanCard));
  }, [breakdowns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const laneCards = useMemo(() => {
    const map: Record<string, CardType[]> = {};
    for (const lane of LANES) {
      map[lane.id] = cards.filter((c) => lane.states.includes(c.state));
    }
    return map;
  }, [cards]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id as string;
    const overId = over.id as string;

    // Find which lane we're over
    const overLane = LANES.find((l) => l.id === overId);
    if (!overLane) return;

    setCards((prev) => {
      const activeCard = prev.find((c) => c.id === activeIdStr);
      if (!activeCard) return prev;
      if (overLane.states.includes(activeCard.state)) return prev;

      return prev.map((c) =>
        c.id === activeIdStr ? { ...c, state: overLane.states[0] } : c,
      );
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeIdStr = active.id as string;
    const overId = over.id as string;

    // If dropped on a lane, update status in Firestore (placeholder)
    const overLane = LANES.find((l) => l.id === overId);
    if (overLane) {
      // TODO: Call API to update breakdown status in Firestore
      console.log(`Move ${activeIdStr} to ${overLane.states[0]}`);
      return;
    }

    // Reorder within same lane
    setCards((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === activeIdStr);
      const newIndex = prev.findIndex((c) => c.id === overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  return (
    <DashboardWidget title="Live Breakdown Board" live loading={loading} error={error}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-5 px-5">
          {LANES.map((lane) => (
            <BreakdownKanbanLane
              key={lane.id}
              id={lane.id}
              title={lane.title}
              borderColor={lane.borderColor}
              cards={laneCards[lane.id] ?? []}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? <BreakdownKanbanCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>
    </DashboardWidget>
  );
}
