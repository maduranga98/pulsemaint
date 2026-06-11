import { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import { useMtbfPerMachine } from '../../../hooks/dashboard/useMtbfPerMachine';
import EmptyState from '../shared/EmptyState';

type SortKey = 'name' | 'health' | 'breakdowns' | 'mttr' | 'mtbf';

function healthColor(score: number) {
  if (score >= 75) return 'text-[#10B981]';
  if (score >= 50) return 'text-[#F59E0B]';
  return 'text-[#EF4444]';
}

function healthBar(score: number) {
  const color =
    score >= 75 ? 'bg-[#10B981]' : score >= 50 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]';
  return (
    <div className="w-16 h-1.5 bg-[#1E3A5F] rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
    </div>
  );
}

interface MachineAnalyticsTableProps {
  companyId: string;
}

export default function MachineAnalyticsTable({ companyId }: MachineAnalyticsTableProps) {
  const { machines, loading, error } = useMtbfPerMachine(companyId);
  const [sortKey, setSortKey] = useState<SortKey>('health');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...machines].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') cmp = a.machineName.localeCompare(b.machineName);
    else if (sortKey === 'health') cmp = a.healthScore - b.healthScore;
    else if (sortKey === 'breakdowns') cmp = a.breakdownCountMTD - b.breakdownCountMTD;
    else if (sortKey === 'mttr') cmp = a.mttrHours - b.mttrHours;
    else if (sortKey === 'mtbf') cmp = a.mtbfDays - b.mtbfDays;
    return sortAsc ? cmp : -cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 text-[#8BA3BF]" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-[#1A56DB]" /> : <ArrowDown className="w-3 h-3 text-[#1A56DB]" />;
  };

  return (
    <DashboardWidget title="Machine-Level Analytics" loading={loading} error={error}>
      {sorted.length === 0 ? (
        <EmptyState message="No machine data" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1">
                    Machine <SortIcon k="name" />
                  </button>
                </th>
                <th className="pb-2 font-medium">
                  <button onClick={() => handleSort('health')} className="flex items-center gap-1">
                    Health <SortIcon k="health" />
                  </button>
                </th>
                <th className="pb-2 font-medium text-right">
                  <button onClick={() => handleSort('breakdowns')} className="flex items-center gap-1 ml-auto">
                    BD MTD <SortIcon k="breakdowns" />
                  </button>
                </th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">
                  <button onClick={() => handleSort('mttr')} className="flex items-center gap-1 ml-auto">
                    MTTR <SortIcon k="mttr" />
                  </button>
                </th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">
                  <button onClick={() => handleSort('mtbf')} className="flex items-center gap-1 ml-auto">
                    MTBF <SortIcon k="mtbf" />
                  </button>
                </th>
                <th className="pb-2 font-medium text-center hidden md:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {sorted.map((m) => (
                <tr key={m.machineId} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      {m.watchFlag && (
                        <AlertTriangle className="w-3 h-3 text-[#EF4444] flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-[#F0F4F8] font-medium leading-tight">{m.machineName}</p>
                        <p className="text-[#8BA3BF] text-[10px]">{m.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-col gap-1">
                      <span className={`font-semibold ${healthColor(m.healthScore)}`}>
                        {m.healthScore}
                      </span>
                      {healthBar(m.healthScore)}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`font-medium ${
                        m.breakdownCountMTD > 3 ? 'text-[#EF4444]' : m.breakdownCountMTD > 1 ? 'text-[#F59E0B]' : 'text-[#F0F4F8]'
                      }`}
                    >
                      {m.breakdownCountMTD}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-[#8BA3BF] hidden sm:table-cell">
                    {m.mttrHours > 0 ? `${m.mttrHours.toFixed(1)}h` : '—'}
                  </td>
                  <td className="py-2.5 text-right text-[#8BA3BF] hidden sm:table-cell">
                    {m.mtbfDays > 0 ? `${m.mtbfDays.toFixed(0)}d` : '—'}
                  </td>
                  <td className="py-2.5 text-center hidden md:table-cell">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        m.currentStatus === 'operational'
                          ? 'bg-[#10B981]/20 text-[#10B981]'
                          : m.currentStatus === 'breakdown'
                            ? 'bg-[#EF4444]/20 text-[#EF4444]'
                            : m.currentStatus === 'maintenance' || m.currentStatus === 'pm_in_progress'
                              ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                              : 'bg-[#8BA3BF]/20 text-[#8BA3BF]'
                      }`}
                    >
                      {m.currentStatus.replace(/_/g, ' ')}
                    </span>
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
