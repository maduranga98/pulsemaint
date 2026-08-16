import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useTopPerformers } from '../../../hooks/dashboard/useTopPerformers';

const ROLE_LABELS: Record<string, string> = {
  plant_manager: 'Plant Manager',
  supervisor: 'Supervisor',
  technician: 'Technician',
  floor_operator: 'Operator',
  trainee: 'Trainee',
  store_keeper: 'Store Keeper',
  hr_officer: 'HR Officer',
  safety_officer: 'Safety Officer',
  admin: 'Admin',
  other: 'Other',
};

function scoreColor(score: number) {
  if (score >= 75) return 'text-[#10B981]';
  if (score >= 50) return 'text-[#F59E0B]';
  return score === 0 ? 'text-[#8BA3BF]' : 'text-[#EF4444]';
}

interface TopPerformersWidgetProps {
  companyId: string;
}

// Top 10 employees company-wide, ranked by combined Evaluation/Audit mark,
// alongside their safety-case points (sum of points from cases they reported).
export default function TopPerformersWidget({ companyId }: TopPerformersWidgetProps) {
  const { data, loading, error, refetch } = useTopPerformers(companyId);

  return (
    <DashboardWidget title="Top 10 Performers by Role" loading={loading} error={error} onRetry={refetch}>
      {data.length === 0 ? (
        <EmptyState message="No performance data yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium text-center">Mark</th>
                <th className="pb-2 font-medium text-center">Safety Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {data.map((row, idx) => (
                <tr key={row.userId} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5 text-[#8BA3BF]">{idx + 1}</td>
                  <td className="py-2.5 text-[#F0F4F8] font-medium">{row.name}</td>
                  <td className="py-2.5 text-[#8BA3BF]">{ROLE_LABELS[row.role] ?? row.role}</td>
                  <td className="py-2.5 text-center">
                    <span className={`font-semibold ${scoreColor(row.mark)}`}>
                      {row.mark}
                      <span className="text-[#8BA3BF] font-normal">/100</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-center text-[#F0F4F8]">{row.safetyPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardWidget>
  );
}
