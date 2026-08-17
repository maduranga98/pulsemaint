import { ClipboardCheck, BookOpen, CheckSquare } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import { useTeamPerformanceAnalytics } from '../../../hooks/dashboard/useTeamPerformanceAnalytics';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

const ROLE_LABELS: Record<string, string> = {
  plant_manager: 'Plant Manager',
  supervisor: 'Supervisor',
  technician: 'Technician',
  operator: 'Operator',
  trainee: 'Trainee',
  store_keeper: 'Store Keeper',
  hr_officer: 'HR Officer',
  floor_operator: 'Floor Operator',
  admin: 'Admin',
  other: 'Other',
};

function scoreColor(score: number) {
  if (score >= 75) return 'text-[#10B981]';
  if (score >= 50) return 'text-[#F59E0B]';
  return score === 0 ? 'text-[#8BA3BF]' : 'text-[#EF4444]';
}

interface TeamPerformanceAnalyticsWidgetProps {
  companyId: string;
}

// Shows the same 6 columns as the "Team Performance" report
// (technician_performance): Name, Role, Evaluation Score, Audit Score,
// Trainings Completed, Quizzes Passed — both read from
// fetchTeamPerformanceByUser so the numbers never drift apart.
export default function TeamPerformanceAnalyticsWidget({ companyId }: TeamPerformanceAnalyticsWidgetProps) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useTeamPerformanceAnalytics(companyId);

  return (
    <DashboardWidget
      title={t('common.widgets.teamPerformanceAnalyticsWidget.title')}
      loading={loading}
      error={error}
      onRetry={refetch}
    >
      {data.length === 0 ? (
        <EmptyState message={t('common.widgets.teamPerformanceAnalyticsWidget.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">{t('common.widgets.teamPerformanceAnalyticsWidget.name')}</th>
                <th className="pb-2 font-medium hidden sm:table-cell">{t('common.widgets.teamPerformanceAnalyticsWidget.role')}</th>
                <th className="pb-2 font-medium text-center">{t('common.widgets.teamPerformanceAnalyticsWidget.evaluationScore')}</th>
                <th className="pb-2 font-medium text-center hidden sm:table-cell">
                  <span className="flex items-center justify-center gap-1">
                    <ClipboardCheck className="w-3 h-3" /> {t('common.widgets.teamPerformanceAnalyticsWidget.auditScore')}
                  </span>
                </th>
                <th className="pb-2 font-medium text-center hidden md:table-cell">
                  <span className="flex items-center justify-center gap-1">
                    <BookOpen className="w-3 h-3" /> {t('common.widgets.teamPerformanceAnalyticsWidget.trainings')}
                  </span>
                </th>
                <th className="pb-2 font-medium text-center hidden md:table-cell">
                  <span className="flex items-center justify-center gap-1">
                    <CheckSquare className="w-3 h-3" /> {t('common.widgets.teamPerformanceAnalyticsWidget.quizzesPassed')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {data.map((row) => (
                <tr key={row.userId} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5 text-[#F0F4F8] font-medium">{row.name}</td>
                  <td className="py-2.5 text-[#8BA3BF] hidden sm:table-cell">
                    {ROLE_LABELS[row.role] ?? row.role}
                  </td>
                  <td className="py-2.5 text-center">
                    {row.hasEvaluation ? (
                      <span className={`font-semibold ${scoreColor(row.evaluationScore)}`}>
                        {row.evaluationScore}
                        <span className="text-[#8BA3BF] font-normal">/100</span>
                      </span>
                    ) : (
                      <span className="text-[#8BA3BF]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center hidden sm:table-cell">
                    {row.hasAudit ? (
                      <span className={`font-semibold ${scoreColor(row.auditScore)}`}>
                        {row.auditScore}
                        <span className="text-[#8BA3BF] font-normal">/100</span>
                      </span>
                    ) : (
                      <span className="text-[#8BA3BF]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center text-[#8BA3BF] hidden md:table-cell">
                    {row.trainingsCompleted || ''}
                  </td>
                  <td className="py-2.5 text-center text-[#8BA3BF] hidden md:table-cell">
                    {row.quizzesPassed || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardWidget>
  );
}
