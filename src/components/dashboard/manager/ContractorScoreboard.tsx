import { TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import { useContractorScoreboard } from '../../../hooks/dashboard/useContractorScoreboard';
import EmptyState from '../shared/EmptyState';

const RANK_COLORS = ['text-[#F59E0B]', 'text-[#94A3B8]', 'text-[#B45309]'];

interface ContractorScoreboardProps {
  companyId: string;
  month: string;
}

export default function ContractorScoreboard({ companyId, month }: ContractorScoreboardProps) {
  const { data, loading, error, refetch } = useContractorScoreboard(companyId, month);
  const contractors = data?.contractorPerformance ?? [];

  return (
    <DashboardWidget title="Contractor Scoreboard" loading={loading} error={error} onRetry={refetch}>
      {contractors.length === 0 ? (
        <EmptyState message="No contractor data" />
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {contractors.map((c, idx) => (
            <div
              key={c.contractorId}
              className="flex items-center gap-3 p-3 bg-[#0A1628] rounded-lg border border-[#1E3A5F]/50 hover:border-[#2E5A8F] transition-colors"
            >
              {/* Rank */}
              <div className="w-6 text-center shrink-0">
                {idx < 3 ? (
                  <Award className={`w-5 h-5 mx-auto ${RANK_COLORS[idx]}`} />
                ) : (
                  <span className="text-xs text-[#8BA3BF]">{idx + 1}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F0F4F8] truncate">{c.contractorName}</p>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[#8BA3BF]">
                  <span>{c.jobsCompleted} jobs</span>
                  <span>SLA {Math.round(c.slaCompliance)}%</span>
                  <span>First-fix {Math.round(c.firstFixRate)}%</span>
                </div>
              </div>

              {/* Trend */}
              <div className="shrink-0">
                {c.ratingTrend === 'up' ? (
                  <TrendingUp className="w-4 h-4 text-[#10B981]" />
                ) : c.ratingTrend === 'down' ? (
                  <TrendingDown className="w-4 h-4 text-[#EF4444]" />
                ) : (
                  <Minus className="w-4 h-4 text-[#8BA3BF]" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
