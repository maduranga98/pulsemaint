import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenWorkOrders } from '../../../hooks/dashboard/useOpenWorkOrders';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { WorkOrder } from '../../../types';

interface WorkOrdersWidgetProps {
  siteId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#1A56DB',
  low: '#8BA3BF',
};

function isToday(value: unknown): boolean {
  const date = (value as { toDate?: () => Date })?.toDate?.() ?? (value ? new Date(value as string) : null);
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function WoRow({ wo, onClick }: { wo: WorkOrder; onClick: () => void }) {
  const color = PRIORITY_COLORS[String(wo.priority).toLowerCase()] ?? '#8BA3BF';
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1E3A5F]/30 transition-colors text-left"
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#F0F4F8] truncate">{wo.woNumber} · {wo.machineName}</p>
        <p className="text-[11px] text-[#8BA3BF] truncate mt-0.5">{wo.woType} · {wo.status.replace(/_/g, ' ')}</p>
      </div>
    </button>
  );
}

export default function WorkOrdersWidget({ siteId }: WorkOrdersWidgetProps) {
  const { workOrders, loading, error } = useOpenWorkOrders(siteId);
  const [tab, setTab] = useState<'running' | 'today'>('running');
  const navigate = useNavigate();

  const running = useMemo(
    () => workOrders.filter((w) => w.status === 'IN_PROGRESS'),
    [workOrders],
  );
  const today = useMemo(
    () => workOrders.filter((w) => isToday(w.dueDate) || isToday(w.scheduledStart)),
    [workOrders],
  );

  const list = tab === 'running' ? running : today;

  return (
    <DashboardWidget
      title="Work Orders"
      live
      loading={loading}
      error={error}
      action={
        <button
          onClick={() => navigate('/app/work-orders')}
          className="text-xs text-[#1A56DB] hover:underline"
        >
          View all
        </button>
      }
    >
      <div className="flex gap-1.5 mb-2">
        <button
          onClick={() => setTab('running')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
            tab === 'running' ? 'bg-[#1A56DB] text-white' : 'bg-[#0A1628] text-[#8BA3BF] hover:text-[#F0F4F8]'
          }`}
        >
          Running ({running.length})
        </button>
        <button
          onClick={() => setTab('today')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
            tab === 'today' ? 'bg-[#1A56DB] text-white' : 'bg-[#0A1628] text-[#8BA3BF] hover:text-[#F0F4F8]'
          }`}
        >
          Today ({today.length})
        </button>
      </div>

      <div className="max-h-[280px] overflow-y-auto -mx-5 divide-y divide-[#1E3A5F]/50">
        {list.length === 0 ? (
          <EmptyState
            message={tab === 'running' ? 'No work orders in progress' : "No work orders due today"}
          />
        ) : (
          list.map((wo) => (
            <WoRow key={wo.id} wo={wo} onClick={() => navigate('/app/work-orders')} />
          ))
        )}
      </div>
    </DashboardWidget>
  );
}
