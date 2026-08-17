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
import { useTranslation } from 'react-i18next';

interface LaneDef {
  id: string;
  title: string;
  states: string[];
  borderColor: string;
}

// Supervisor's Live Breakdown Board focuses the supervisor's action queue on
// today's breakdowns: the ones just reported and the ones a technician has
// resolved but still need a supervisor to sign off and close. Breakdowns that
// are mid-repair, on hold, or already closed are intentionally excluded.
const LANES: (Omit<LaneDef, 'title'> & { titleKey: string })[] = [
  { id: 'newly_reported', titleKey: 'newlyReported', states: ['reported', 'acknowledged', 'triage_in_progress'], borderColor: '#F59E0B' },
  { id: 'sign_off', titleKey: 'signOff', states: ['resolved'], borderColor: '#10B981' },
];

const VISIBLE_STATES = new Set(LANES.flatMap((l) => l.states));

// Only today's breakdowns belong on this board.
function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

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
  const { t } = useTranslation();
  const { breakdowns, loading, error } = useActiveBreakdowns(companyId, (status) =>
    VISIBLE_STATES.has(status),
  );
  const [cards, setCards] = useState<CardType[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync cards from Firestore, keeping only breakdowns reported today.
  useMemo(() => {
    setCards(breakdowns.map(toKanbanCard).filter((c) => isToday(c.reportedAt)));
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
    <DashboardWidget title={t('common.widgets.breakdownKanbanBoard.title')} live loading={loading} error={error}>
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
              title={t(`common.widgets.breakdownKanbanBoard.lanes.${lane.titleKey}`)}
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
