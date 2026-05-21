import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { BreakdownKanbanCard as CardType } from '../../../types/analytics.types';
import BreakdownKanbanCard from './BreakdownKanbanCard';

interface BreakdownKanbanLaneProps {
  id: string;
  title: string;
  cards: CardType[];
  borderColor: string;
}

export default function BreakdownKanbanLane({ id, title, cards, borderColor }: BreakdownKanbanLaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] flex-1 flex flex-col rounded-xl border border-[#1E3A5F] bg-[#0A1628]/50 transition-colors ${
        isOver ? 'bg-[#1A56DB]/10 border-[#1A56DB]' : ''
      }`}
    >
      {/* Lane header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[#1E3A5F] rounded-t-xl"
        style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
      >
        <h4 className="text-sm font-semibold text-[#F0F4F8] font-[Sora]">{title}</h4>
        <span className="px-2 py-0.5 rounded-full bg-[#1E3A5F] text-[11px] font-medium text-[#8BA3BF]">
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[600px]">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <BreakdownKanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="h-24 flex items-center justify-center text-[11px] text-[#8BA3BF]">
            No items
          </div>
        )}
      </div>
    </div>
  );
}
