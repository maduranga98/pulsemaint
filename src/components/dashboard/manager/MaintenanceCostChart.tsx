// MaintenanceCostChart
import DashboardWidget from '../shared/DashboardWidget';
import { useMaintenanceCostTrend } from '../../../hooks/dashboard/useMaintenanceCostTrend';
import EmptyState from '../shared/EmptyState';

interface MaintenanceCostChartProps {
  companyId: string;
  month: string;
}

export default function MaintenanceCostChart({ companyId, month }: MaintenanceCostChartProps) {
  const { data, loading, error, refetch } = useMaintenanceCostTrend(companyId, month);

  return (
    <DashboardWidget
      title="Maintenance Cost Overview"
      loading={loading}
      error={error}
      onRetry={refetch}
    >
      {!data ? (
        <EmptyState message="No cost data" />
      ) : (
        <div className="h-64 flex flex-col items-center justify-center">
          <p className="text-sm text-[#8BA3BF] mb-2">Total Maintenance Cost This Month</p>
          <p className="text-5xl font-bold text-[#F0F4F8] font-[Sora]">
            LKR {data.totalMaintenanceCost.toLocaleString()}
          </p>
        </div>
      )}
    </DashboardWidget>
  );
}
