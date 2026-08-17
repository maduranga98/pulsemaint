import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import { usePendingReceiptPOs } from '../../../hooks/dashboard/usePendingReceiptPOs';
import EmptyState from '../shared/EmptyState';
import type { PurchaseOrderStatus } from '../../../types/inventory';
import { useTranslation } from 'react-i18next';

interface PendingReceiptPOsWidgetProps {
  companyId: string;
}

const STATUS_BADGE: Partial<Record<PurchaseOrderStatus, { key: string; className: string }>> = {
  sent: { key: 'sent', className: 'bg-[#1A56DB]/15 text-[#5B8DEF]' },
  invoice_received: { key: 'invoiceReceived', className: 'bg-purple-500/15 text-purple-300' },
  acknowledged: { key: 'acknowledged', className: 'bg-cyan-500/15 text-cyan-300' },
  partially_received: { key: 'partiallyReceived', className: 'bg-[#F59E0B]/15 text-[#F59E0B]' },
};

export default function PendingReceiptPOsWidget({ companyId }: PendingReceiptPOsWidgetProps) {
  const { t } = useTranslation();
  const { orders, loading, error } = usePendingReceiptPOs(companyId);
  const navigate = useNavigate();

  return (
    <DashboardWidget title={t('common.widgets.pendingReceiptPOsWidget.title')} loading={loading} error={error}>
      {orders.length === 0 ? (
        <EmptyState message={t('common.widgets.pendingReceiptPOsWidget.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">{t('common.widgets.pendingReceiptPOsWidget.poNumber')}</th>
                <th className="pb-2 font-medium">{t('common.widgets.pendingReceiptPOsWidget.supplier')}</th>
                <th className="pb-2 font-medium">{t('common.widgets.pendingReceiptPOsWidget.statusHeader')}</th>
                <th className="pb-2 font-medium text-right">{t('common.widgets.pendingReceiptPOsWidget.items')}</th>
                <th className="pb-2 font-medium text-right">{t('common.widgets.pendingReceiptPOsWidget.value')}</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {orders.map((po) => {
                const badge = STATUS_BADGE[po.status];
                return (
                <tr key={po.id} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5 text-[#F0F4F8] font-medium">{po.poNumber}</td>
                  <td className="py-2.5 text-[#8BA3BF]">{po.supplierName}</td>
                  <td className="py-2.5">
                    {badge && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.className}`}>
                        {t(`common.widgets.pendingReceiptPOsWidget.status.${badge.key}`)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right text-[#F0F4F8]">{po.items.length}</td>
                  <td className="py-2.5 text-right text-[#F0F4F8]">
                    LKR {po.totalOrderValue.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => navigate(`/app/inventory/purchase-orders/${po.id}`)}
                      className="px-2 py-1 bg-[#1A56DB] text-white text-[10px] font-medium rounded hover:bg-[#1A56DB]/90 transition-colors"
                    >
                      {t('common.widgets.common.view')}
                    </button>
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
