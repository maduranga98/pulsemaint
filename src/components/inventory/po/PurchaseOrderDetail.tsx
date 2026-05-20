import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageCheck, XCircle, CheckCircle2 } from 'lucide-react';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/useToast';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/inventory';

interface PurchaseOrderDetailProps {
  order: PurchaseOrder;
}

const statusConfig: Record<PurchaseOrderStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Sent', cls: 'bg-blue-100 text-blue-700' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-cyan-100 text-cyan-700' },
  received: { label: 'Received', cls: 'bg-green-100 text-green-700' },
  partially_received: { label: 'Partially Received', cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
};

const TIMELINE_STEPS: { key: keyof PurchaseOrder; label: string }[] = [
  { key: 'raisedAt', label: 'Raised' },
  { key: 'sentAt', label: 'Sent' },
  { key: 'acknowledgedAt', label: 'Acknowledged' },
  { key: 'receivedAt', label: 'Received' },
];

function formatDate(ts: PurchaseOrder['raisedAt'] | null | undefined): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString();
}

export function PurchaseOrderDetail({ order }: PurchaseOrderDetailProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const sc = statusConfig[order.status];

  async function handleCancel() {
    setCancelling(true);
    try {
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      addToast('Purchase order cancelled.', 'success');
      setCancelModal(false);
    } catch {
      addToast('Failed to cancel PO.', 'error');
    } finally {
      setCancelling(false);
    }
  }

  const grandTotal = order.items.reduce((sum, it) => sum + it.totalCost, 0);
  const outstanding = order.items.reduce(
    (sum, it) => sum + Math.max(0, it.quantityOrdered - it.quantityReceived) * it.unitCost,
    0
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-[Sora]">{order.poNumber}</h2>
            <p className="text-gray-600 mt-0.5">{order.supplierName}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${sc.cls}`}>
              {sc.label}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Timeline</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {TIMELINE_STEPS.map((step, idx) => {
              const ts = order[step.key] as PurchaseOrder['raisedAt'] | null;
              const done = !!ts;
              return (
                <div key={step.key} className="flex items-center gap-2">
                  <div className={`flex flex-col items-center gap-1`}>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center ${done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}
                    >
                      {done ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs">{idx + 1}</span>}
                    </div>
                    <span className="text-xs text-gray-600 whitespace-nowrap">{step.label}</span>
                    {done && <span className="text-xs text-gray-400">{formatDate(ts)}</span>}
                  </div>
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <div className={`h-0.5 w-8 mb-8 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Items table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Order Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Part</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Ordered</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Received</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Outstanding</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Unit Cost</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.map((item) => {
                  const outstandingQty = Math.max(0, item.quantityOrdered - item.quantityReceived);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-mono text-gray-700 text-xs">{item.partNumber}</p>
                        <p className="text-gray-900 font-medium">{item.partName}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{item.quantityOrdered}</td>
                      <td className="px-4 py-3 text-green-700 font-medium">{item.quantityReceived}</td>
                      <td className="px-4 py-3">
                        <span className={outstandingQty > 0 ? 'text-amber-700 font-medium' : 'text-gray-400'}>
                          {outstandingQty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {order.currency} {item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-semibold whitespace-nowrap">
                        {order.currency} {item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Totals footer */}
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-6 justify-end text-sm">
            <div className="text-right">
              <p className="text-gray-500">Outstanding</p>
              <p className="font-bold text-amber-700">
                {order.currency} {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-500">Grand Total</p>
              <p className="font-bold text-gray-900 text-lg">
                {order.currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {(order.status === 'sent' || order.status === 'acknowledged' || order.status === 'partially_received') && (
            <button
              onClick={() => navigate(`/app/inventory/receive?poId=${order.id}`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <PackageCheck className="w-4 h-4" />
              Mark as Received
            </button>
          )}
          {order.status !== 'received' && order.status !== 'cancelled' && (
            <button
              onClick={() => setCancelModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-xl transition-colors text-sm"
            >
              <XCircle className="w-4 h-4" />
              Cancel PO
            </button>
          )}
        </div>
      </div>

      {/* Cancel confirmation */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Cancel Purchase Order?</h3>
            <p className="text-sm text-gray-600">
              This purchase order will be marked as cancelled and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelModal(false)}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Keep PO
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
