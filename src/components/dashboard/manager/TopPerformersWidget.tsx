import { Award, ClipboardCheck, BookOpen, CheckSquare, ShieldAlert } from 'lucide-react';
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

const RANK_COLORS = ['text-[#F59E0B]', 'text-[#94A3B8]', 'text-[#B45309]'];

function scoreColor(score: number) {
  if (score >= 75) return 'text-[#10B981]';
  if (score >= 50) return 'text-[#F59E0B]';
  return score === 0 ? 'text-[#8BA3BF]' : 'text-[#EF4444]';
}

interface TopPerformersWidgetProps {
  companyId: string;
}

// Leaderboard version of the "Team Performance" table: ranks everyone who
// has at least one Evaluation or Audit score by a composite of the two
// (averaging whichever are available), less any safety-case penalty points
// (see safetyPenaltyPoints — cases reported "about" this person as a
// technician/operator/contractor), breaks ties by training/quiz activity,
// and shows only the top 10 — so the widget reads as "who's performing
// best" instead of a flat, unordered, unbounded roster.
export default function TopPerformersWidget({ companyId }: TopPerformersWidgetProps) {
  const { data, loading, error, refetch } = useTeamPerformanceAnalytics(companyId);

  const ranked = data
    .filter((row) => row.hasEvaluation || row.hasAudit)
    .map((row) => {
      const scores = [row.hasEvaluation ? row.evaluationScore : null, row.hasAudit ? row.auditScore : null]
        .filter((s): s is number => s !== null);
      const rawScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const compositeScore = Math.max(0, rawScore - row.safetyPenaltyPoints);
      return { ...row, compositeScore };
    })
    .sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
      const activityA = a.trainingsCompleted + a.quizzesPassed;
      const activityB = b.trainingsCompleted + b.quizzesPassed;
      if (activityB !== activityA) return activityB - activityA;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);

  return (
    <DashboardWidget title="Top 10 Performing Team Members" loading={loading} error={error} onRetry={refetch}>
      {ranked.length === 0 ? (
        <EmptyState message="No performance data yet" subMessage="Rankings appear once evaluations or audits are submitted." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium w-8">#</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium hidden sm:table-cell">Role</th>
                <th className="pb-2 font-medium text-center">Score</th>
                <th className="pb-2 font-medium text-center hidden sm:table-cell">Eval</th>
                <th className="pb-2 font-medium text-center hidden sm:table-cell">
                  <span className="flex items-center justify-center gap-1">
                    <ClipboardCheck className="w-3 h-3" /> Audit
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
                <th className="pb-2 font-medium text-center hidden md:table-cell">
                  <span className="flex items-center justify-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Safety
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {ranked.map((row, idx) => (
                <tr key={row.userId} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5">
                    {idx < 3 ? (
                      <Award className={`w-4 h-4 ${RANK_COLORS[idx]}`} />
                    ) : (
                      <span className="text-[#8BA3BF]">{idx + 1}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-[#F0F4F8] font-medium">{row.name}</td>
                  <td className="py-2.5 text-[#8BA3BF] hidden sm:table-cell">{ROLE_LABELS[row.role] ?? row.role}</td>
                  <td className="py-2.5 text-center">
                    <span className={`font-bold ${scoreColor(row.compositeScore)}`}>
                      {row.compositeScore}
                      <span className="text-[#8BA3BF] font-normal">/100</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-center hidden sm:table-cell">
                    {row.hasEvaluation ? (
                      <span className={`font-medium ${scoreColor(row.evaluationScore)}`}>{row.evaluationScore}</span>
                    ) : (
                      <span className="text-[#8BA3BF]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center hidden sm:table-cell">
                    {row.hasAudit ? (
                      <span className={`font-medium ${scoreColor(row.auditScore)}`}>{row.auditScore}</span>
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
                  <td className="py-2.5 text-center hidden md:table-cell">
                    {row.safetyPenaltyPoints > 0 ? (
                      <span className="font-medium text-[#EF4444]">-{row.safetyPenaltyPoints}</span>
                    ) : (
                      <span className="text-[#8BA3BF]">—</span>
                    )}
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
