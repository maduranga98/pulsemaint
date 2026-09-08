import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Eye, Pencil, PackageCheck, XCircle, CheckCircle2 } from 'lucide-react';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/inventory';

interface PurchaseOrderListProps {
  orders: PurchaseOrder[];
  onView: (id: string) => void;
  onEdit?: (id: string) => void;
  onMarkReceived?: (id: string) => void;
  onCancel?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const statusClsConfig: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  invoice_received: 'bg-purple-100 text-purple-700',
  acknowledged: 'bg-cyan-100 text-cyan-700',
  received: 'bg-green-100 text-green-700',
  partially_received: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  pending_approval: 'bg-amber-100 text-amber-700',
};

function statusFilters(t: TFunction): { label: string; value: PurchaseOrderStatus | 'all' }[] {
  return [
    { label: t('common.inventory.po.list.filters.statusAll'), value: 'all' },
    { label: t('common.inventory.po.statuses.draft'), value: 'draft' },
    { label: t('common.inventory.po.statuses.pending_approval'), value: 'pending_approval' },
    { label: t('common.inventory.po.statuses.approved'), value: 'approved' },
    { label: t('common.inventory.po.statuses.rejected'), value: 'rejected' },
    { label: t('common.inventory.po.statuses.sent'), value: 'sent' },
    { label: t('common.inventory.po.statuses.invoice_received'), value: 'invoice_received' },
    { label: t('common.inventory.po.statuses.acknowledged'), value: 'acknowledged' },
    { label: t('common.inventory.po.statuses.received'), value: 'received' },
    { label: t('common.inventory.po.statuses.partially_received'), value: 'partially_received' },
    { label: t('common.inventory.po.statuses.cancelled'), value: 'cancelled' },
  ];
}

function formatDate(ts: PurchaseOrder['raisedAt']): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString();
}

export function PurchaseOrderList({
  orders,
  onView,
  onEdit,
  onMarkReceived,
  onCancel,
  onApprove,
  onReject,
}: PurchaseOrderListProps) {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'all'>('all');
  const [supplierSearch, setSupplierSearch] = useState('');

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchSupplier = !supplierSearch || o.supplierName.toLowerCase().includes(supplierSearch.toLowerCase());
    return matchStatus && matchSupplier;
  });

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg font-medium">{t('common.inventory.po.list.empty.title')}</p>
        <p className="text-sm mt-1">{t('common.inventory.po.list.empty.subtitle')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={supplierSearch}
          onChange={(e) => setSupplierSearch(e.target.value)}
          placeholder={t('common.inventory.po.list.filters.supplierSearchPlaceholder')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | 'all')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {statusFilters(t).map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-8">{t('common.inventory.po.list.noMatch')}</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.list.columns.poNumber')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.list.columns.supplier')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.list.columns.items')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.list.columns.totalValue')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.list.columns.status')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.list.columns.raisedBy')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.list.columns.date')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.list.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((order) => {
                const scCls = statusClsConfig[order.status];
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-gray-900 whitespace-nowrap">
                      {order.poNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{order.supplierName}</td>
                    <td className="px-4 py-3 text-gray-600">{order.items.length}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                      {order.currency} {order.totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${scCls}`}>
                        {t(`common.inventory.po.statuses.${order.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{order.raisedByName}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(order.raisedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => onView(order.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          {t('common.inventory.po.list.actions.view')}
                        </button>
                        {onEdit && order.status === 'draft' && (
                          <button
                            onClick={() => onEdit(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            {t('common.inventory.po.list.actions.edit')}
                          </button>
                        )}
                        {onApprove && order.status === 'pending_approval' && (
                          <button
                            onClick={() => onApprove(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {t('common.inventory.po.list.actions.approve')}
                          </button>
                        )}
                        {onReject && order.status === 'pending_approval' && (
                          <button
                            onClick={() => onReject(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <XCircle className="w-3 h-3" />
                            {t('common.inventory.po.list.actions.reject')}
                          </button>
                        )}
                        {onMarkReceived && (order.status === 'sent' || order.status === 'invoice_received' || order.status === 'acknowledged' || order.status === 'partially_received') && (
                          <button
                            onClick={() => onMarkReceived(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                          >
                            <PackageCheck className="w-3 h-3" />
                            {t('common.inventory.po.list.actions.receive')}
                          </button>
                        )}
                        {onCancel && order.status !== 'received' && order.status !== 'cancelled' && (
                          <button
                            onClick={() => onCancel(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <XCircle className="w-3 h-3" />
                            {t('common.inventory.po.list.actions.cancel')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
