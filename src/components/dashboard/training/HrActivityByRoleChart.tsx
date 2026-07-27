import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';
import { useTeamPerformanceByRole } from '../../../hooks/dashboard/useTeamPerformanceByRole';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  plant_manager: 'Manager',
  supervisor: 'Supervisor',
  technician: 'Technician',
  floor_operator: 'Operator',
  trainee: 'Trainee',
  store_keeper: 'Store Keeper',
  hr_officer: 'HR Officer',
  other: 'Other',
};

interface HrActivityByRoleChartProps {
  companyId: string;
}

// Evaluations, Audit sessions, and Triage (Quick Assessment) activity by
// role in one chart — feeds the HR dashboard's graphical metrics (HR-002).
export default function HrActivityByRoleChart({ companyId }: HrActivityByRoleChartProps) {
  const { data, loading, error, refetch } = useTeamPerformanceByRole(companyId);

  const chartData = data
    .filter((row) => row.evaluationCount > 0 || row.auditCount > 0 || row.quizAttempts > 0)
    .map((row) => ({
      role: ROLE_LABELS[row.role] ?? row.role,
      Evaluations: row.evaluationCount,
      Audits: row.auditCount,
      'Triage Assessments': row.quizAttempts,
    }));

  return (
    <DashboardWidget title="Evaluations, Audit & Triage Activity by Role" loading={loading} error={error} onRetry={refetch}>
      {chartData.length === 0 ? (
        <EmptyState message="No evaluation, audit, or triage activity yet" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="role" />
              <YAxis {...CHART_DEFAULTS.yAxis} allowDecimals={false} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Legend {...CHART_DEFAULTS.legend} />
              <Bar dataKey="Evaluations" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Audits" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Triage Assessments" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
