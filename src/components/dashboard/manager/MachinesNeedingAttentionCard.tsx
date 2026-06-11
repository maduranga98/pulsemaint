import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useFleetTco } from '../../../hooks/useFleetTco';

function money(n: number | null): string {
  if (n == null) return '—';
  return `LKR ${Math.round(n).toLocaleString('en-LK')}`;
}

export default function MachinesNeedingAttentionCard() {
  const navigate = useNavigate();
  const { ranking, loading, error } = useFleetTco();

  // Prioritise machines with a known spend ratio (replacement value set);
  // already sorted by ratio desc in the hook.
  const top3 = useMemo(
    () => ranking.filter((r) => r.spendRatio != null && r.cumulativeMaintenanceSpend > 0).slice(0, 3),
    [ranking],
  );

  return (
    <DashboardWidget title="Machines Needing Attention" loading={loading} error={error}>
      {top3.length === 0 ? (
        <EmptyState message="No machines flagged on cost of ownership." />
      ) : (
        <ul className="space-y-2">
          {top3.map((row, idx) => {
            const pct = row.spendRatio != null ? Math.round(row.spendRatio * 100) : null;
            return (
              <li
                key={row.machineId}
                onClick={() => navigate(`/app/machines/${row.machineId}`)}
                className="flex items-center gap-3 py-2 px-2 -mx-2 rounded cursor-pointer hover:bg-[#13243F]"
              >
                <span className="flex-shrink-0 h-7 w-7 rounded-full bg-[#13243F] text-[#8BA3BF] text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#F0F4F8] truncate flex items-center gap-1.5">
                    {row.replacementRecommended && (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
                    )}
                    {row.machineName}
                  </p>
                  <p className="text-xs text-[#8BA3BF]">
                    {money(row.cumulativeMaintenanceSpend)} spent
                    {pct != null && ` · ${pct}% of replacement`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#56708F]" />
              </li>
            );
          })}
        </ul>
      )}
    </DashboardWidget>
  );
}
