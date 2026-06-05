import { useState } from 'react';
import { Eye, Pencil, PackageCheck, XCircle } from 'lucide-react';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/inventory';

interface PurchaseOrderListProps {
  orders: PurchaseOrder[];
  onView: (id: string) => void;
  onEdit?: (id: string) => void;
  onMarkReceived?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const statusConfig: Record<PurchaseOrderStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Sent', cls: 'bg-blue-100 text-blue-700' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-cyan-100 text-cyan-700' },
  received: { label: 'Received', cls: 'bg-green-100 text-green-700' },
  partially_received: { label: 'Partial', cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-600' },
  pending_approval: { label: 'Pending Approval', cls: 'bg-amber-100 text-amber-700' },
};

const STATUS_FILTERS: { label: string; value: PurchaseOrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Acknowledged', value: 'acknowledged' },
  { label: 'Received', value: 'received' },
  { label: 'Partial', value: 'partially_received' },
  { label: 'Cancelled', value: 'cancelled' },
];

function formatDate(ts: PurchaseOrder['raisedAt']): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString();
}

export function PurchaseOrderList({
  orders,
  onView,
  onEdit,
  onMarkReceived,
  onCancel,
}: PurchaseOrderListProps) {
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
        <p className="text-lg font-medium">No purchase orders yet</p>
        <p className="text-sm mt-1">Create your first purchase order to get started.</p>
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
          placeholder="Search supplier…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | 'all')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No orders match your filters.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">PO #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Supplier</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Items</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Total Value</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Raised By</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((order) => {
                const sc = statusConfig[order.status];
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
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sc.cls}`}>
                        {sc.label}
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
                          View
                        </button>
                        {onEdit && order.status === 'draft' && (
                          <button
                            onClick={() => onEdit(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                        )}
                        {onMarkReceived && (order.status === 'sent' || order.status === 'acknowledged' || order.status === 'partially_received') && (
                          <button
                            onClick={() => onMarkReceived(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                          >
                            <PackageCheck className="w-3 h-3" />
                            Receive
                          </button>
                        )}
                        {onCancel && order.status !== 'received' && order.status !== 'cancelled' && (
                          <button
                            onClick={() => onCancel(order.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <XCircle className="w-3 h-3" />
                            Cancel
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
