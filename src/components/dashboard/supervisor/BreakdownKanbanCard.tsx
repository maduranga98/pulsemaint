import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Wrench, Zap, Droplets, Wind, Monitor, HelpCircle } from 'lucide-react';
import { useDashboardStore } from '../../../store/dashboard.store';
import type { BreakdownKanbanCard as CardType } from '../../../types/analytics.types';
import BreakdownElapsedTimer from './BreakdownElapsedTimer';
import SlaCountdownBadge from './SlaCountdownBadge';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  mechanical: <Wrench className="w-3.5 h-3.5" />,
  electrical: <Zap className="w-3.5 h-3.5" />,
  hydraulic: <Droplets className="w-3.5 h-3.5" />,
  pneumatic: <Wind className="w-3.5 h-3.5" />,
  software: <Monitor className="w-3.5 h-3.5" />,
};

const SEVERITY_COLORS: Record<string, { border: string; badge: string }> = {
  critical: { border: 'border-l-[#EF4444]', badge: 'bg-[#EF4444]/20 text-[#EF4444]' },
  high: { border: 'border-l-[#F59E0B]', badge: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
  medium: { border: 'border-l-[#EAB308]', badge: 'bg-[#EAB308]/20 text-[#EAB308]' },
  low: { border: 'border-l-[#10B981]', badge: 'bg-[#10B981]/20 text-[#10B981]' },
};

interface BreakdownKanbanCardProps {
  card: CardType;
}

export default function BreakdownKanbanCard({ card }: BreakdownKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const setSidePanel = useDashboardStore((s) => s.setSidePanel);
  const severity = SEVERITY_COLORS[card.severity] ?? SEVERITY_COLORS.medium;
  const TypeIcon = TYPE_ICONS[card.breakdownType] ?? <HelpCircle className="w-3.5 h-3.5" />;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setSidePanel({ type: 'breakdown', id: card.id })}
      className={`bg-[#0F1E35] border border-[#1E3A5F] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-[#2E5A8F] transition-colors border-l-4 ${severity.border} ${
        card.state === 'repair_in_progress' ? 'animate-pulse border-l-[#00C2FF]' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#F0F4F8] truncate">{card.machineName}</p>
          <p className="text-[11px] text-[#8BA3BF] truncate">{card.machineLocation}</p>
        </div>
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${severity.badge}`}>
          {card.severity}
        </span>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 mt-2">
        <span className="flex items-center gap-1 text-[#8BA3BF]">{TypeIcon}</span>
        <BreakdownElapsedTimer
          startTime={card.reportedAt}
          className={card.slaBreach ? 'text-[#EF4444]' : 'text-[#8BA3BF]'}
        />
      </div>

      {/* SLA */}
      <div className="mt-2">
        <SlaCountdownBadge deadline={card.slaDeadline} />
      </div>

      {/* Technician */}
      {card.assignedTechnicianName && (
        <div className="mt-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#1A56DB]/20 text-[#1A56DB] flex items-center justify-center text-[9px] font-bold">
            {card.assignedTechnicianName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <span className="text-[11px] text-[#8BA3BF] truncate">{card.assignedTechnicianName}</span>
        </div>
      )}
    </div>
  );
}
