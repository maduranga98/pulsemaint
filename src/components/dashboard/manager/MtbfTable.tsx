import { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import { useMtbfPerMachine } from '../../../hooks/dashboard/useMtbfPerMachine';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

type SortKey = 'mtbf' | 'name' | 'type';

interface MtbfTableProps {
  companyId: string;
}

export default function MtbfTable({ companyId }: MtbfTableProps) {
  const { t } = useTranslation();
  const { machines, loading, error } = useMtbfPerMachine(companyId);
  const [sortKey, setSortKey] = useState<SortKey>('mtbf');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...machines].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'mtbf') cmp = a.mtbfDays - b.mtbfDays;
    else if (sortKey === 'name') cmp = a.machineName.localeCompare(b.machineName);
    else if (sortKey === 'type') cmp = a.department.localeCompare(b.department);
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
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-[#1A56DB]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#1A56DB]" />
    );
  };

  return (
    <DashboardWidget title={t('common.widgets.mtbfTable.title')} loading={loading} error={error}>
      {sorted.length === 0 ? (
        <EmptyState message={t('common.widgets.mtbfTable.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1">
                    {t('common.widgets.mtbfTable.machine')} <SortIcon k="name" />
                  </button>
                </th>
                <th className="pb-2 font-medium">
                  <button onClick={() => handleSort('type')} className="flex items-center gap-1">
                    {t('common.widgets.mtbfTable.dept')} <SortIcon k="type" />
                  </button>
                </th>
                <th className="pb-2 font-medium text-right">
                  <button onClick={() => handleSort('mtbf')} className="flex items-center gap-1 ml-auto">
                    {t('common.widgets.mtbfTable.mtbf')} <SortIcon k="mtbf" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {sorted.slice(0, 10).map((m) => (
                <tr key={m.machineId} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5 text-[#F0F4F8] font-medium">{m.machineName}</td>
                  <td className="py-2.5 text-[#8BA3BF]">{m.department}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`font-semibold ${
                        m.mtbfDays < 30 ? 'text-[#EF4444]' : m.mtbfDays < 60 ? 'text-[#F59E0B]' : 'text-[#10B981]'
                      }`}
                    >
                      {m.mtbfDays.toFixed(0)}d
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
