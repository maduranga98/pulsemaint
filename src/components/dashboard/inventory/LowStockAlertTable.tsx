import DashboardWidget from '../shared/DashboardWidget';
import { useInventoryHealth } from '../../../hooks/dashboard/useInventoryHealth';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';
import { Cog } from 'lucide-react';
import { useMachineOptions } from '../../../hooks/inventory/useMachineOptions';

interface LowStockAlertTableProps {
  companyId: string;
}

export default function LowStockAlertTable({ companyId }: LowStockAlertTableProps) {
  const { t } = useTranslation();
  const { parts, loading, error } = useInventoryHealth(companyId);
  // Parts linked to machines are that machine's spare parts — name the machines.
  const { machines } = useMachineOptions();
  const machineName = new Map(machines.map((m) => [m.id, m.name]));

  const lowStock = parts
    .filter((p) => p.currentStock <= (p.minStockLevel ?? 0))
    .sort((a, b) => a.currentStock - b.currentStock)
    .slice(0, 20);

  const getRowColor = (qty: number, min: number) => {
    if (qty === 0) return 'bg-[#EF4444]/10';
    if (qty < min) return 'bg-[#F59E0B]/10';
    return '';
  };

  return (
    <DashboardWidget title={t('common.widgets.lowStockAlertTable.title')} loading={loading} error={error}>
      {lowStock.length === 0 ? (
        <EmptyState message={t('common.widgets.lowStockAlertTable.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">{t('common.widgets.lowStockAlertTable.part')}</th>
                <th className="pb-2 font-medium">{t('common.widgets.lowStockAlertTable.category')}</th>
                <th className="pb-2 font-medium text-right">{t('common.widgets.lowStockAlertTable.stock')}</th>
                <th className="pb-2 font-medium text-right">{t('common.widgets.lowStockAlertTable.min')}</th>
                <th className="pb-2 font-medium text-right">{t('common.widgets.lowStockAlertTable.deficit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {lowStock.map((p) => (
                <tr key={p.id} className={`hover:bg-[#1E3A5F]/20 ${getRowColor(p.currentStock, p.minStockLevel ?? 0)}`}>
                  <td className="py-2.5">
                    <p className="text-[#F0F4F8] font-medium">{p.name}</p>
                    <p className="text-[10px] text-[#8BA3BF]">{p.partNumber}</p>
                    {(p.compatibleMachineIds ?? []).length > 0 && (
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                        <span className="rounded bg-[#F59E0B]/15 px-1.5 py-0.5 font-semibold text-[#F59E0B]">Spare part</span>
                        <Cog className="h-3 w-3 text-[#8BA3BF]" />
                        <span className="text-[#B8C7DB]">
                          {(p.compatibleMachineIds ?? []).map((id) => machineName.get(id) ?? 'Machine').join(', ')}
                        </span>
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 text-[#8BA3BF]">{p.category}</td>
                  <td className="py-2.5 text-right text-[#F0F4F8]">{p.currentStock}</td>
                  <td className="py-2.5 text-right text-[#8BA3BF]">{p.minStockLevel ?? 0}</td>
                  <td className="py-2.5 text-right text-[#EF4444]">{(p.minStockLevel ?? 0) - p.currentStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardWidget>
  );
}
