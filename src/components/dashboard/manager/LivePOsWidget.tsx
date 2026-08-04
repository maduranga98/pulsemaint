import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { usePurchaseOrders } from '../../../hooks/inventory/usePurchaseOrders';

/** Purchase orders currently awaiting approval — live so a new request
 * appears here the moment a store keeper raises one. */
export default function LivePOsWidget() {
  const { orders, loading, error } = usePurchaseOrders('pending_approval');

  return (
    <DashboardWidget
      title="Live PO Requests"
      loading={loading}
      error={error}
      live
      action={<span className="text-xs text-[#8BA3BF]">{orders.length} pending</span>}
    >
      {orders.length === 0 ? (
        <EmptyState message="No purchase orders awaiting approval" />
      ) : (
        <div className="space-y-1.5">
          {orders.map((po) => (
            <div
              key={po.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#F0F4F8]">{po.poNumber}</p>
                <p className="truncate text-[11px] text-[#8BA3BF]">{po.supplierName}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#1A56DB]/20 px-2 py-0.5 text-[10px] font-semibold text-[#5B8DEF]">
                LKR {po.totalOrderValue.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
