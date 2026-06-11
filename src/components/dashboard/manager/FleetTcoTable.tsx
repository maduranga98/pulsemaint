import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useFleetTco } from '../../../hooks/useFleetTco';

function money(n: number | null): string {
  if (n == null) return '—';
  return `LKR ${Math.round(n).toLocaleString('en-LK')}`;
}

export default function FleetTcoTable() {
  const navigate = useNavigate();
  const { ranking, loading, error } = useFleetTco();

  return (
    <DashboardWidget title="Fleet TCO Ranking" loading={loading} error={error}>
      {ranking.length === 0 ? (
        <EmptyState message="No machines to rank yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#8BA3BF] uppercase tracking-wide border-b border-[#1E3A5F]">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Machine</th>
                <th className="px-2 py-2 text-right">Maint. Spend</th>
                <th className="px-2 py-2 text-right">Replacement</th>
                <th className="px-2 py-2 text-right">Repairs %</th>
                <th className="px-2 py-2 text-center">WOs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#13243F]">
              {ranking.slice(0, 15).map((row, idx) => {
                const pct = row.spendRatio != null ? Math.round(row.spendRatio * 100) : null;
                return (
                  <tr
                    key={row.machineId}
                    onClick={() => navigate(`/app/machines/${row.machineId}`)}
                    className="cursor-pointer hover:bg-[#13243F]"
                  >
                    <td className="px-2 py-2 text-[#8BA3BF]">{idx + 1}</td>
                    <td className="px-2 py-2 text-[#F0F4F8] font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {row.replacementRecommended && (
                          <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
                        )}
                        {row.machineName}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-[#F0F4F8]">
                      {money(row.cumulativeMaintenanceSpend)}
                    </td>
                    <td className="px-2 py-2 text-right text-[#8BA3BF]">
                      {money(row.replacementValue)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {pct != null ? (
                        <span
                          className={`font-semibold ${
                            row.replacementRecommended ? 'text-[#EF4444]' : 'text-[#F0F4F8]'
                          }`}
                        >
                          {pct}%
                        </span>
                      ) : (
                        <span className="text-[#56708F]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center text-[#8BA3BF]">{row.workOrderCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[#56708F]">
            Ranked by cumulative repair spend relative to replacement value. Red = repairs exceed 60%
            of replacement value.
          </p>
        </div>
      )}
    </DashboardWidget>
  );
}
