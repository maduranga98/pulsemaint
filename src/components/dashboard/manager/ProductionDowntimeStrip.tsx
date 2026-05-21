import DashboardWidget from '../shared/DashboardWidget';
import { useDashboardStore } from '../../../store/dashboard.store';


interface ProductionDowntimeStripProps {
  companyId: string;
}

export default function ProductionDowntimeStrip({}: ProductionDowntimeStripProps) {
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  const loading = useDashboardStore((s) => s.analyticsLoading);

  const hours = monthly?.totalProductionHoursLost ?? 0;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);

  return (
    <DashboardWidget title="Production Downtime" loading={loading}>
      <div className="py-4 text-center bg-gradient-to-r from-[#EF4444]/10 via-transparent to-[#EF4444]/10 rounded-lg">
        <p className="text-sm text-[#8BA3BF] mb-2">Production Hours Lost This Month</p>
        <p className="text-4xl font-bold text-[#EF4444] font-[Sora]">
          {h}h {m}m
        </p>
        <div className="flex justify-center gap-8 mt-4 text-xs">
          <div>
            <p className="text-[#8BA3BF]">This week</p>
            <p className="text-[#F0F4F8] font-semibold">{Math.round(hours / 4)}h</p>
          </div>
          <div>
            <p className="text-[#8BA3BF]">Today</p>
            <p className="text-[#F0F4F8] font-semibold">{Math.round(hours / 30)}h</p>
          </div>
          <div>
            <p className="text-[#8BA3BF]">Est. cost</p>
            <p className="text-[#F0F4F8] font-semibold">LKR {(hours * 5000).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </DashboardWidget>
  );
}
