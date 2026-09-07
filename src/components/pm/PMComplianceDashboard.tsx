import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import type { ComplianceStats, MachineComplianceRecord, TechnicianComplianceRecord } from '../../types/pm.types';
import { getComplianceColor, getComplianceTailwindClass } from '../../utils/pm.utils';
import { BRAND_COLORS } from '../../constants/brand';

interface PMComplianceDashboardProps {
  stats: ComplianceStats | null;
  loading?: boolean;
}

export function PMComplianceDashboardComponent({ stats, loading }: PMComplianceDashboardProps) {
  const { t } = useTranslation();

  if (loading || !stats) {
    return <div className="p-8 text-center text-gray-400">{t('common.pmSchedules.complianceDashboard.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label={t('common.pmSchedules.complianceDashboard.kpi.overallCompliance')}
          value={`${stats.overallComplianceRate}%`}
          color={getComplianceColor(stats.overallComplianceRate)}
          twClass={getComplianceTailwindClass(stats.overallComplianceRate)}
        />
        <KPICard
          label={t('common.pmSchedules.complianceDashboard.kpi.scheduledThisMonth')}
          value={String(stats.totalScheduledThisMonth)}
          color={BRAND_COLORS.powerBlue}
          twClass="text-blue-600"
        />
        <KPICard
          label={t('common.pmSchedules.complianceDashboard.kpi.completedOnTime')}
          value={String(stats.completedOnTimeThisMonth)}
          color={BRAND_COLORS.uptimeGreen}
          twClass="text-emerald-600"
        />
        <KPICard
          label={t('common.pmSchedules.complianceDashboard.kpi.overdue')}
          value={String(stats.overdueCount)}
          color={stats.overdueCount > 0 ? BRAND_COLORS.criticalRed : BRAND_COLORS.uptimeGreen}
          twClass={stats.overdueCount > 0 ? 'text-red-600' : 'text-emerald-600'}
        />
      </div>

      {/* Trend Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4">{t('common.pmSchedules.complianceDashboard.trendChartTitle')}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                domain={[0, 100]}
                label={{ value: t('common.pmSchedules.complianceDashboard.chart.percentAxisLabel'), angle: -90, position: 'insideLeft' }}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="right"
                dataKey="breakdownCount"
                name={t('common.pmSchedules.complianceDashboard.chart.breakdowns')}
                fill={BRAND_COLORS.criticalRed}
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="complianceRate"
                name={t('common.pmSchedules.complianceDashboard.chart.complianceRate')}
                stroke={BRAND_COLORS.powerBlue}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ComplianceTable
          title={t('common.pmSchedules.complianceDashboard.byMachineTitle')}
          data={stats.byMachine}
          nameKey="machineName"
        />
        <ComplianceTable
          title={t('common.pmSchedules.complianceDashboard.byTechnicianTitle')}
          data={stats.byTechnician}
          nameKey="technicianName"
        />
      </div>
    </div>
  );
}

function KPICard({ label, value, twClass }: { label: string; value: string; color: string; twClass: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${twClass}`}>{value}</p>
    </div>
  );
}

function ComplianceTable({
  title,
  data,
  nameKey,
}: {
  title: string;
  data: MachineComplianceRecord[] | TechnicianComplianceRecord[];
  nameKey: 'machineName' | 'technicianName';
}) {
  const { t } = useTranslation();
  const idKey = nameKey === 'machineName' ? 'machineId' : 'technicianId';

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700">{t('common.pmSchedules.complianceDashboard.table.name')}</th>
              <th className="px-4 py-2 text-right font-medium text-gray-700">{t('common.pmSchedules.complianceDashboard.table.rate')}</th>
              <th className="px-4 py-2 text-right font-medium text-gray-700">{t('common.pmSchedules.complianceDashboard.table.scheduled')}</th>
              <th className="px-4 py-2 text-right font-medium text-gray-700">{t('common.pmSchedules.complianceDashboard.table.onTime')}</th>
              <th className="px-4 py-2 text-right font-medium text-gray-700">{t('common.pmSchedules.complianceDashboard.table.missed')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((record) => (
              <tr key={(record as unknown as Record<string, string>)[idKey]} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-900">{(record as unknown as Record<string, string>)[nameKey]}</td>
                <td className="px-4 py-2 text-right">
                  <span className={`font-semibold ${getComplianceTailwindClass(record.complianceRate)}`}>
                    {record.complianceRate}%
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-gray-600">{(record as unknown as Record<string, number>).totalScheduled ?? (record as unknown as Record<string, number>).totalAssigned}</td>
                <td className="px-4 py-2 text-right text-emerald-600">{record.completedOnTime}</td>
                <td className="px-4 py-2 text-right text-red-600">{record.missed}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="p-6 text-center text-gray-400 text-xs">{t('common.pmSchedules.complianceDashboard.noData')}</div>
        )}
      </div>
    </div>
  );
}
