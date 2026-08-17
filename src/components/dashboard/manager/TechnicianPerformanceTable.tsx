import { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Star } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import { useTechnicianPerformance } from '../../../hooks/dashboard/useTechnicianPerformance';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

type SortKey = 'jobs' | 'response' | 'repair' | 'sla' | 'name';

interface TechnicianPerformanceTableProps {
  companyId: string;
  month: string | string[];
}

export default function TechnicianPerformanceTable({ companyId, month }: TechnicianPerformanceTableProps) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useTechnicianPerformance(companyId, month);
  const [sortKey, setSortKey] = useState<SortKey>('jobs');
  const [sortAsc, setSortAsc] = useState(false);

  const records = data?.technicianPerformance ?? [];

  const sorted = [...records].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'jobs') cmp = a.jobsCompleted - b.jobsCompleted;
    else if (sortKey === 'response') cmp = a.avgResponseMins - b.avgResponseMins;
    else if (sortKey === 'repair') cmp = a.avgRepairHours - b.avgRepairHours;
    else if (sortKey === 'sla') cmp = a.slaCompliance - b.slaCompliance;
    else if (sortKey === 'name') cmp = a.techName.localeCompare(b.techName);
    return sortAsc ? cmp : -cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 text-[#8BA3BF]" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-[#1A56DB]" /> : <ArrowDown className="w-3 h-3 text-[#1A56DB]" />;
  };

  const maxJobs = Math.max(1, ...records.map((r) => r.jobsCompleted));
  const minSla = Math.min(100, ...records.map((r) => r.slaCompliance));

  return (
    <DashboardWidget title={t('common.widgets.technicianPerformanceTable.title')} loading={loading} error={error} onRetry={refetch}>
      {sorted.length === 0 ? (
        <EmptyState message={t('common.widgets.technicianPerformanceTable.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1">{t('common.widgets.technicianPerformanceTable.tech')} <SortIcon k="name" /></button>
                </th>
                <th className="pb-2 font-medium text-right">
                  <button onClick={() => handleSort('jobs')} className="flex items-center gap-1 ml-auto">{t('common.widgets.technicianPerformanceTable.jobs')} <SortIcon k="jobs" /></button>
                </th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">
                  <button onClick={() => handleSort('response')} className="flex items-center gap-1 ml-auto">{t('common.widgets.technicianPerformanceTable.resp')} <SortIcon k="response" /></button>
                </th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">
                  <button onClick={() => handleSort('repair')} className="flex items-center gap-1 ml-auto">{t('common.widgets.technicianPerformanceTable.repair')} <SortIcon k="repair" /></button>
                </th>
                <th className="pb-2 font-medium text-right">
                  <button onClick={() => handleSort('sla')} className="flex items-center gap-1 ml-auto">{t('common.widgets.technicianPerformanceTable.sla')} <SortIcon k="sla" /></button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {sorted.map((r) => {
                const isTop = r.jobsCompleted === maxJobs && maxJobs > 0;
                const isLowSla = r.slaCompliance === minSla && minSla < 100;
                return (
                  <tr
                    key={r.techId}
                    className={`hover:bg-[#1E3A5F]/20 ${isTop ? 'border-l-2 border-l-[#F59E0B]' : ''} ${
                      isLowSla ? 'border-l-2 border-l-[#EF4444]' : ''
                    }`}
                  >
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        {isTop && <Star className="w-3 h-3 text-[#F59E0B]" />}
                        <span className="text-[#F0F4F8] font-medium">{r.techName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-[#F0F4F8]">{r.jobsCompleted}</td>
                    <td className="py-2.5 text-right text-[#8BA3BF] hidden sm:table-cell">{r.avgResponseMins}m</td>
                    <td className="py-2.5 text-right text-[#8BA3BF] hidden sm:table-cell">{r.avgRepairHours.toFixed(1)}h</td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`font-semibold ${
                          r.slaCompliance >= 90 ? 'text-[#10B981]' : r.slaCompliance >= 70 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                        }`}
                      >
                        {Math.round(r.slaCompliance)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardWidget>
  );
}
