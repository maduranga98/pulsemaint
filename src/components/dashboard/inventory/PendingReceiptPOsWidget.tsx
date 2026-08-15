import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import { usePendingReceiptPOs } from '../../../hooks/dashboard/usePendingReceiptPOs';
import EmptyState from '../shared/EmptyState';

interface PendingReceiptPOsWidgetProps {
  companyId: string;
}

export default function PendingReceiptPOsWidget({ companyId }: PendingReceiptPOsWidgetProps) {
  const { orders, loading, error } = usePendingReceiptPOs(companyId);
  const navigate = useNavigate();

  return (
    <DashboardWidget title="Pending PO Receipts" loading={loading} error={error}>
      {orders.length === 0 ? (
        <EmptyState message="No POs awaiting receipt" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">PO #</th>
                <th className="pb-2 font-medium">Supplier</th>
                <th className="pb-2 font-medium text-right">Items</th>
                <th className="pb-2 font-medium text-right">Value</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {orders.map((po) => (
                <tr key={po.id} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5 text-[#F0F4F8] font-medium">{po.poNumber}</td>
                  <td className="py-2.5 text-[#8BA3BF]">{po.supplierName}</td>
                  <td className="py-2.5 text-right text-[#F0F4F8]">{po.items.length}</td>
                  <td className="py-2.5 text-right text-[#F0F4F8]">
                    LKR {po.totalOrderValue.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => navigate(`/app/inventory/purchase-orders/${po.id}`)}
                      className="px-2 py-1 bg-[#1A56DB] text-white text-[10px] font-medium rounded hover:bg-[#1A56DB]/90 transition-colors"
                    >
                      View
                    </button>
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
