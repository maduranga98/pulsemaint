import { useState, useCallback } from 'react';
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { useToast } from '@/hooks/useToast';
import { ReceiveItemRow } from './ReceiveItemRow';
import type { PurchaseOrderItem } from '@/types/inventory';

interface ItemRowData {
  quantityReceived: number;
  unitCost: number;
  condition: string;
  notes: string;
}

export function ReceiveAgainstPo() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId;
  const toast = useToast();

  const { orders, loading: ordersLoading } = usePurchaseOrders();
  const pendingOrders = orders.filter((o) =>
    ['sent', 'acknowledged', 'partially_received', 'draft'].includes(o.status)
  );

  const [selectedPoId, setSelectedPoId] = useState('');
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryRef, setDeliveryRef] = useState('');
  const [notes, setNotes] = useState('');
  const [rowData, setRowData] = useState<Record<string, ItemRowData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPo = pendingOrders.find((o) => o.id === selectedPoId);

  const handleRowUpdate = useCallback((itemId: string, data: ItemRowData) => {
    setRowData((prev) => ({ ...prev, [itemId]: data }));
  }, []);

  async function handleSubmit() {
    if (!selectedPo || !userProfile || !companyId) return;
    setIsSubmitting(true);

    try {
      await runTransaction(db, async (tx) => {
        const now = serverTimestamp();

        const updatedItems: PurchaseOrderItem[] = [];

        for (const item of selectedPo.items) {
          const row = rowData[item.id];
          const qty = row?.quantityReceived ?? 0;
          const cost = row?.unitCost ?? item.unitCost;
          const cond = row?.condition ?? 'good';

          const newReceived = item.quantityReceived + qty;
          updatedItems.push({ ...item, quantityReceived: newReceived });

          if (qty > 0 && cond === 'good') {
            const partRef = doc(db, 'inventoryParts', item.partId);
            const partSnap = await tx.get(partRef);
            if (partSnap.exists()) {
              const data = partSnap.data();
              const currentStock = (data.currentStock as number) ?? 0;

              tx.update(partRef, {
                currentStock: currentStock + qty,
                lastReceivedAt: now,
                lastPurchasePrice: cost,
                lastPurchaseDate: now,
                updatedAt: now,
                updatedBy: userProfile.id,
              });

              const movRef = doc(collection(db, 'stockMovements'));
              tx.set(movRef, {
                companyId,
                partId: item.partId,
                partNumber: item.partNumber,
                partName: item.partName,
                movementType: 'receive',
                quantityBefore: currentStock,
                quantityChange: qty,
                quantityAfter: currentStock + qty,
                referenceType: 'purchase_order',
                referenceId: selectedPo.id,
                workOrderId: null,
                workOrderNumber: null,
                partsRequestId: null,
                performedBy: userProfile.id,
                performedByName: userProfile.fullName,
                performedByRole: userProfile.role,
                performedAt: now,
                notes: row?.notes ?? '',
                unitCostAtTime: cost,
                totalCostImpact: cost * qty,
              });
            }
          }
        }

        // Update PO status
        const allFullyReceived = updatedItems.every(
          (i) => i.quantityReceived >= i.quantityOrdered
        );
        const anyReceived = updatedItems.some((i) => i.quantityReceived > 0);

        const poRef = doc(db, 'purchaseOrders', selectedPo.id);
        tx.update(poRef, {
          items: updatedItems,
          status: allFullyReceived ? 'received' : anyReceived ? 'partially_received' : selectedPo.status,
          receivedAt: allFullyReceived ? now : selectedPo.receivedAt,
          updatedAt: now,
        });
      });

      toast.success('Stock received successfully');
      setSelectedPoId('');
      setRowData({});
      setDeliveryRef('');
      setNotes('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to record receipt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* PO selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Purchase Order
        </label>
        <select
          value={selectedPoId}
          onChange={(e) => { setSelectedPoId(e.target.value); setRowData({}); }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={ordersLoading}
        >
          <option value="">— Select PO —</option>
          {pendingOrders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.poNumber} · {o.supplierName} · {o.status}
            </option>
          ))}
        </select>
      </div>

      {selectedPo && (
        <>
          {/* Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Receive Date</label>
              <input
                type="date"
                value={receiveDate}
                onChange={(e) => setReceiveDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Reference</label>
              <input
                type="text"
                value={deliveryRef}
                onChange={(e) => setDeliveryRef(e.target.value)}
                placeholder="e.g. DN-2025-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {selectedPo.items.map((item, idx) => (
              <ReceiveItemRow
                key={item.id}
                index={idx}
                item={{
                  partId: item.partId,
                  partNumber: item.partNumber,
                  partName: item.partName,
                  unit: 'pcs',
                  quantityOrdered: item.quantityOrdered,
                  quantityReceivedSoFar: item.quantityReceived,
                }}
                onUpdate={(data) => handleRowUpdate(item.id, data)}
              />
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Any additional notes about this delivery…"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Confirming Receipt…' : 'Confirm Receipt'}
          </button>
        </>
      )}
    </div>
  );
}
