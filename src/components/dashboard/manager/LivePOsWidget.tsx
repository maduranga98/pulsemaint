import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { usePurchaseOrders } from '../../../hooks/inventory/usePurchaseOrders';
import { usePlantNameLookup } from '../../../hooks/usePlantNameLookup';
import PlantBadge from '../shared/PlantBadge';
import { getCompanyCurrency } from '@/lib/currency';
import { usePurchaseOrderDecisions } from '../../../hooks/inventory/usePurchaseOrderDecisions';

/** Purchase orders currently awaiting approval — live so a new request
 * appears here the moment a store keeper raises one. */
export default function LivePOsWidget() {
  const { t } = useTranslation();
  // usePurchaseOrders is already limited to the caller's plant.
  const { orders, loading, error } = usePurchaseOrders('pending_approval');
  const plantName = usePlantNameLookup();
  const { canApprove, approve, reject } = usePurchaseOrderDecisions();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(po: (typeof orders)[number], action: typeof approve) {
    setBusyId(po.id);
    try {
      await action(po);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardWidget
      title={t('common.dashboard.livePOs.title')}
      loading={loading}
      error={error}
      live
      action={<span className="text-xs text-[#8BA3BF]">{t('common.dashboard.livePOs.pending', { count: orders.length })}</span>}
    >
      {orders.length === 0 ? (
        <EmptyState message={t('common.dashboard.livePOs.empty')} />
      ) : (
        <div className="space-y-1.5">
          {orders.map((po) => (
            <div
              key={po.id}
              className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#F0F4F8]">{po.poNumber}</p>
                  <p className="truncate text-[11px] text-[#8BA3BF]">{po.supplierName}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <PlantBadge name={plantName(po.plantId)} />
                  <span className="rounded-full bg-[#1A56DB]/20 px-2 py-0.5 text-[10px] font-semibold text-[#5B8DEF]">
                    {getCompanyCurrency()} {po.totalOrderValue.toLocaleString()}
                  </span>
                </div>
              </div>
              {canApprove && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === po.id}
                    onClick={() => decide(po, approve)}
                    className="flex-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {t('common.dashboard.livePOs.approve')}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === po.id}
                    onClick={() => decide(po, reject)}
                    className="flex-1 rounded-md border border-red-500/50 bg-[#0F1E35] px-2 py-1 text-xs font-semibold text-red-300 hover:bg-[#1E3A5F] disabled:opacity-50"
                  >
                    {t('common.dashboard.livePOs.reject')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
