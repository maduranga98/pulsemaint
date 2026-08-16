import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';
import { useTeamPerformanceByRole } from '../../../hooks/dashboard/useTeamPerformanceByRole';
import type { DateRange } from '../../../services/teamPerformance.service';

// Every role counts toward the company's total active-employee figure, not
// just the frontline/ops roles the old "headcount strip" (HR-001) tracked.
const ROLE_ORDER: Array<{ role: string; label: string }> = [
  { role: 'technician', label: 'Technicians' },
  { role: 'supervisor', label: 'Supervisors' },
  { role: 'plant_manager', label: 'Managers' },
  { role: 'floor_operator', label: 'Operators' },
  { role: 'trainee', label: 'Trainees' },
  { role: 'store_keeper', label: 'Store Keepers' },
  { role: 'hr_officer', label: 'HR Officers' },
  { role: 'safety_officer', label: 'Safety Officers' },
  { role: 'admin', label: 'Admins' },
];

const BAR_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
  '#8B5CF6',
];

interface StaffByRoleChartProps {
  companyId: string;
  dateRange?: DateRange | null;
}

export default function StaffByRoleChart({ companyId, dateRange }: StaffByRoleChartProps) {
  const { data, loading, error, refetch } = useTeamPerformanceByRole(companyId, dateRange);

  const memberCountByRole = new Map(data.map((row) => [row.role, row.memberCount]));
  const chartData = ROLE_ORDER.map(({ role, label }) => ({
    role: label,
    count: memberCountByRole.get(role) ?? 0,
  }));
  const hasData = chartData.some((d) => d.count > 0);
  const totalActive = data.reduce((sum, row) => sum + row.memberCount, 0);

  return (
    <DashboardWidget
      title="Employees by Role"
      loading={loading}
      error={error}
      onRetry={refetch}
      action={<span className="text-xs text-[#8BA3BF]">{totalActive} active employees</span>}
    >
      {!hasData ? (
        <EmptyState message="No staff data" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} horizontal={false} />
              <XAxis {...CHART_DEFAULTS.xAxis} type="number" allowDecimals={false} />
              <YAxis {...CHART_DEFAULTS.yAxis} type="category" dataKey="role" width={100} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Bar dataKey="count" name="Staff" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={entry.role} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
