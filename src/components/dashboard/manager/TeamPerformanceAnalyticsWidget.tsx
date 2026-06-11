import { Users, ClipboardCheck, BookOpen, CheckSquare } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import { useTeamPerformanceAnalytics } from '../../../hooks/dashboard/useTeamPerformanceAnalytics';
import EmptyState from '../shared/EmptyState';

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

export default function TeamPerformanceAnalyticsWidget({ companyId }: TeamPerformanceAnalyticsWidgetProps) {
  const { data, loading, error, refetch } = useTeamPerformanceAnalytics(companyId);

  return (
    <DashboardWidget
      title="Team Performance by Role"
      loading={loading}
      error={error}
      onRetry={refetch}
    >
      {data.length === 0 ? (
        <EmptyState message="No team performance data" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium text-center">
                  <span className="flex items-center justify-center gap-1">
                    <Users className="w-3 h-3" /> Members
                  </span>
                </th>
                <th className="pb-2 font-medium text-center hidden sm:table-cell">
                  <span className="flex items-center justify-center gap-1">
                    Avg Score
                  </span>
                </th>
                <th className="pb-2 font-medium text-center hidden sm:table-cell">
                  <span className="flex items-center justify-center gap-1">
                    <ClipboardCheck className="w-3 h-3" /> Audits
                  </span>
                </th>
                <th className="pb-2 font-medium text-center hidden md:table-cell">
                  <span className="flex items-center justify-center gap-1">
                    <BookOpen className="w-3 h-3" /> Trainings
                  </span>
                </th>
                <th className="pb-2 font-medium text-center hidden md:table-cell">
                  <span className="flex items-center justify-center gap-1">
                    <CheckSquare className="w-3 h-3" /> Quizzes
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {data.map((row) => (
                <tr key={row.role} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5 text-[#F0F4F8] font-medium">
                    {ROLE_LABELS[row.role] ?? row.role}
                  </td>
                  <td className="py-2.5 text-center text-[#8BA3BF]">{row.memberCount}</td>
                  <td className="py-2.5 text-center hidden sm:table-cell">
                    {row.evaluationCount > 0 ? (
                      <span className={`font-semibold ${scoreColor(row.avgEvaluationScore)}`}>
                        {row.avgEvaluationScore}
                        <span className="text-[#8BA3BF] font-normal">/100</span>
                      </span>
                    ) : (
                      <span className="text-[#8BA3BF]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center text-[#8BA3BF] hidden sm:table-cell">
                    {row.auditCount || '—'}
                  </td>
                  <td className="py-2.5 text-center text-[#8BA3BF] hidden md:table-cell">
                    {row.trainingsCompleted || '—'}
                  </td>
                  <td className="py-2.5 text-center text-[#8BA3BF] hidden md:table-cell">
                    {row.quizzesPassed || '—'}
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
