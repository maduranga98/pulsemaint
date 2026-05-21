import { Clock, AlertTriangle } from 'lucide-react';
import type { WorkOrder } from '../../../types';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'border-l-[#EF4444]',
  high: 'border-l-[#F59E0B]',
  medium: 'border-l-[#EAB308]',
  low: 'border-l-[#10B981]',
};

interface JobQueueItemProps {
  wo: WorkOrder;
}

export default function JobQueueItem({ wo }: JobQueueItemProps) {
  const dueDate = wo.dueDate?.toDate ? wo.dueDate.toDate() : new Date(wo.dueDate as any);
  const isOverdue = dueDate.getTime() < Date.now();
  const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 bg-[#0A1628] rounded-lg border border-[#1E3A5F] border-l-4 ${PRIORITY_COLORS[wo.priority] || 'border-l-[#8BA3BF]'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#F0F4F8]">{wo.woNumber}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#1E3A5F] text-[#8BA3BF] uppercase">
            {wo.woType.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-[#8BA3BF] truncate mt-0.5">{wo.machineName} · {wo.machineLocation}</p>
      </div>

      <div className="text-right shrink-0">
        <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-[#EF4444]' : daysUntil <= 2 ? 'text-[#F59E0B]' : 'text-[#8BA3BF]'}`}>
          {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          <span>{isOverdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Today' : `${daysUntil}d`}</span>
        </div>
        <p className="text-[10px] text-[#8BA3BF] mt-0.5">{wo.status.replace('_', ' ')}</p>
      </div>
    </div>
  );
}
