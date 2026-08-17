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
import { useTranslation } from 'react-i18next';

// Every role counts toward the company's total active-employee figure, not
// just the frontline/ops roles the old "headcount strip" (HR-001) tracked.
const ROLE_ORDER: Array<{ role: string; labelKey: string }> = [
  { role: 'technician', labelKey: 'technicians' },
  { role: 'supervisor', labelKey: 'supervisors' },
  { role: 'plant_manager', labelKey: 'managers' },
  { role: 'floor_operator', labelKey: 'operators' },
  { role: 'trainee', labelKey: 'trainees' },
  { role: 'store_keeper', labelKey: 'storeKeepers' },
  { role: 'hr_officer', labelKey: 'hrOfficers' },
  { role: 'safety_officer', labelKey: 'safetyOfficers' },
  { role: 'admin', labelKey: 'admins' },
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
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useTeamPerformanceByRole(companyId, dateRange);

  const memberCountByRole = new Map(data.map((row) => [row.role, row.memberCount]));
  const chartData = ROLE_ORDER.map(({ role, labelKey }) => ({
    role: t(`common.widgets.staffByRoleChart.roles.${labelKey}`),
    count: memberCountByRole.get(role) ?? 0,
  }));
  const hasData = chartData.some((d) => d.count > 0);
  const totalActive = data.reduce((sum, row) => sum + row.memberCount, 0);

  return (
    <DashboardWidget
      title={t('common.widgets.staffByRoleChart.title')}
      loading={loading}
      error={error}
      onRetry={refetch}
      action={<span className="text-xs text-[#8BA3BF]">{t('common.widgets.staffByRoleChart.activeEmployees', { count: totalActive })}</span>}
    >
      {!hasData ? (
        <EmptyState message={t('common.widgets.staffByRoleChart.empty')} />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} horizontal={false} />
              <XAxis {...CHART_DEFAULTS.xAxis} type="number" allowDecimals={false} />
              <YAxis {...CHART_DEFAULTS.yAxis} type="category" dataKey="role" width={100} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Bar dataKey="count" name={t('common.widgets.staffByRoleChart.staff')} radius={[0, 4, 4, 0]}>
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
