import KpiCard from '../shared/KpiCard';
import { useInventoryHealth } from '../../../hooks/dashboard/useInventoryHealth';
import { useTranslation } from 'react-i18next';

interface InventoryHealthStripProps {
  companyId: string;
}

export default function InventoryHealthStrip({ companyId }: InventoryHealthStripProps) {
  const { t } = useTranslation();
  const { stats, loading } = useInventoryHealth(companyId);

  const cards = [
    { label: t('common.widgets.inventoryHealthStrip.totalParts'), value: stats.totalParts, color: 'blue' as const },
    { label: t('common.widgets.inventoryHealthStrip.lowStock'), value: stats.lowStockItems, color: (stats.lowStockItems > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: t('common.widgets.inventoryHealthStrip.outOfStock'), value: stats.outOfStockItems, color: (stats.outOfStockItems > 0 ? 'red' : 'green') as 'red' | 'green' },
    { label: t('common.widgets.inventoryHealthStrip.pendingRequests'), value: stats.pendingPartsRequests, color: (stats.pendingPartsRequests > 0 ? 'amber' : 'green') as 'amber' | 'green' },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <KpiCard key={idx} data={card} />
      ))}
    </div>
  );
}
