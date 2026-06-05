import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/authStore';
import { useKaizenList } from '../hooks/useKaizen';
import { transitionState, canTransition } from '../services/kaizen.service';
import { KaizenCard } from './KaizenCard';
import { KaizenDetail } from './KaizenDetail';
import { KaizenForm } from './KaizenForm';
import type { KaizenCard as KaizenCardType, KaizenStatus, KaizenCategory, KaizenPriority } from '../types/kaizen.types';
import { KAIZEN_STATUS_META, VALID_TRANSITIONS } from '../types/kaizen.types';

const BOARD_COLUMNS: KaizenStatus[] = [
  'RAISED',
  'REVIEWED',
  'APPROVED',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'VERIFIED',
];

const SIDEBAR_COLUMNS: KaizenStatus[] = ['REJECTED', 'ON_HOLD'];

interface BoardFilters {
  category?: KaizenCategory;
  priority?: KaizenPriority;
  search?: string;
  myKaizens?: boolean;
}

interface Props {
  filters?: BoardFilters;
  isProPlan?: boolean;
}

// ─── Droppable Column ─────────────────────────────────────────────────────────

function DroppableColumn({
  status,
  cards,
  isDragOver,
  children,
}: {
  status: KaizenStatus;
  cards: KaizenCardType[];
  isDragOver: boolean;
  children: React.ReactNode;
}) {
  const meta = KAIZEN_STATUS_META[status];
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border-2 transition-colors min-h-[400px] ${
        isDragOver
          ? 'border-dashed border-blue-400 bg-blue-50/30'
          : 'border-transparent bg-[#0F1E35]'
      }`}
      style={{ minWidth: 240, width: 260 }}
    >
      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: meta.color }}
          />
          <span className="text-sm font-semibold text-white">{meta.label}</span>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: `${meta.color}40` }}
        >
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

// ─── Sortable Card Wrapper ────────────────────────────────────────────────────

function SortableKaizenCard({
  card,
  onCardClick,
  isProPlan,
}: {
  card: KaizenCardType;
  onCardClick: (c: KaizenCardType) => void;
  isProPlan: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KaizenCard card={card} onClick={onCardClick} isProPlan={isProPlan} />
    </div>
  );
}

// ─── KaizenBoard ──────────────────────────────────────────────────────────────

export function KaizenBoard({ filters = {}, isProPlan = false }: Props) {
  const userId = useAuthStore((s) => s.userProfile?.id ?? '');
  const userName = useAuthStore((s) => s.userProfile?.fullName ?? '');
  const role = useAuthStore((s) => s.userProfile?.role ?? 'technician');
  const plantId = useAuthStore((s) => s.userProfile?.companyId ?? '');

  const { cards, loading } = useKaizenList({});

  const [draggingCard, setDraggingCard] = useState<KaizenCardType | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [overColumnId, setOverColumnId] = useState<KaizenStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Apply board-level filters
  const filteredCards = cards.filter((card) => {
    if (filters.category && card.category !== filters.category) return false;
    if (filters.priority && card.priority !== filters.priority) return false;
    if (filters.myKaizens && card.raisedBy !== userId) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (
        !card.title.toLowerCase().includes(s) &&
        !card.area.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  function getColumnCards(status: KaizenStatus) {
    return filteredCards.filter((c) => c.status === status);
  }

  function handleDragStart(event: DragStartEvent) {
    const card = filteredCards.find((c) => c.id === event.active.id);
    setDraggingCard(card ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingCard(null);
    setOverColumnId(null);

    if (!over || !draggingCard) return;
    const newStatus = over.id as KaizenStatus;
    if (newStatus === draggingCard.status) return;

    // Validate the transition
    const valid = VALID_TRANSITIONS[draggingCard.status]?.includes(newStatus) ?? false;
    if (!valid) {
      toast.error(`Cannot move directly from ${draggingCard.status} to ${newStatus}`);
      return;
    }
    if (!canTransition(draggingCard.status, newStatus, role)) {
      toast.error(`Your role cannot perform this transition`);
      return;
    }

    // Optimistic update not needed — onSnapshot handles real-time sync
    try {
      await transitionState(plantId, active.id as string, newStatus, '', userId, userName, role);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    setOverColumnId((event.over?.id as KaizenStatus) ?? null);
  }

  const handleCardClick = useCallback((card: KaizenCardType) => {
    setDetailCardId(card.id);
  }, []);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4 animate-pulse">
        {BOARD_COLUMNS.map((s) => (
          <div key={s} className="rounded-xl bg-[#0F1E35] min-w-[240px] h-80" />
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {/* Main columns */}
          {BOARD_COLUMNS.map((status) => {
            const columnCards = getColumnCards(status);
            return (
              <DroppableColumn
                key={status}
                status={status}
                cards={columnCards}
                isDragOver={overColumnId === status}
              >
                <SortableContext
                  items={columnCards.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {columnCards.map((card) => (
                    <SortableKaizenCard
                      key={card.id}
                      card={card}
                      onCardClick={handleCardClick}
                      isProPlan={isProPlan}
                    />
                  ))}
                </SortableContext>

                {/* Add button in RAISED column */}
                {status === 'RAISED' && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg border border-dashed border-gray-600 transition-colors mt-1"
                  >
                    <Plus size={13} /> New Kaizen
                  </button>
                )}
              </DroppableColumn>
            );
          })}

          {/* Sidebar toggle */}
          <div className="flex-shrink-0">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {showSidebar ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <span className="rotate-90 whitespace-nowrap">Rejected / On Hold</span>
            </button>
          </div>

          {/* Collapsed sidebar columns */}
          {showSidebar &&
            SIDEBAR_COLUMNS.map((status) => {
              const columnCards = getColumnCards(status);
              return (
                <DroppableColumn
                  key={status}
                  status={status}
                  cards={columnCards}
                  isDragOver={overColumnId === status}
                >
                  <SortableContext
                    items={columnCards.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {columnCards.map((card) => (
                      <SortableKaizenCard
                        key={card.id}
                        card={card}
                        onCardClick={handleCardClick}
                        isProPlan={isProPlan}
                      />
                    ))}
                  </SortableContext>
                </DroppableColumn>
              );
            })}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggingCard && (
            <div className="opacity-80 rotate-2 shadow-2xl">
              <KaizenCard
                card={draggingCard}
                onClick={() => {}}
                isProPlan={isProPlan}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Detail drawer */}
      {detailCardId && (
        <KaizenDetail
          cardId={detailCardId}
          onClose={() => setDetailCardId(null)}
          isProPlan={isProPlan}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <KaizenForm onClose={() => setShowForm(false)} />
      )}
    </>
  );
}
