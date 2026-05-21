import DashboardWidget from '../shared/DashboardWidget';
import { useTechnicianStatuses } from '../../../hooks/dashboard/useTechnicianStatuses';
import TechnicianStatusRow from './TechnicianStatusRow';
import EmptyState from '../shared/EmptyState';

interface TechnicianStatusListProps {
  companyId: string;
}

export default function TechnicianStatusList({ companyId }: TechnicianStatusListProps) {
  const { technicians, loading, error } = useTechnicianStatuses(companyId);

  const sorted = [...technicians].sort((a, b) => {
    const order = { on_job: 0, available: 1, on_break: 2, off_shift: 3 };
    return (order[a.currentStatus] ?? 99) - (order[b.currentStatus] ?? 99);
  });

  return (
    <DashboardWidget
      title="Technician Status"
      live
      loading={loading}
      error={error}
      action={
        <span className="text-xs text-[#8BA3BF]">
          {technicians.filter((t) => t.currentStatus !== 'off_shift').length} active
        </span>
      }
    >
      {sorted.length === 0 ? (
        <EmptyState message="No technicians on shift" />
      ) : (
        <div className="max-h-[320px] overflow-y-auto -mx-5 divide-y divide-[#1E3A5F]/50">
          {sorted.map((t) => (
            <TechnicianStatusRow key={t.userId} technician={t} />
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
