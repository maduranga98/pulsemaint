import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { useToast } from '@/hooks/useToast';
import { ReceiveItemRow } from './ReceiveItemRow';
import type { PurchaseOrder, PurchaseOrderItem } from '@/types/inventory';
import { getNextDeliveryRef } from '@/lib/inventory/deliveryRefGenerator';
import { openPOPrintView } from '@/lib/inventory/poPrintView';

interface ItemRowData {
  quantityReceived: number;
  unitCost: number;
  condition: string;
  notes: string;
}

export function ReceiveAgainstPo() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const companyId = userProfile?.companyId;
  const toast = useToast();
  const navigate = useNavigate();

  const { orders, loading: ordersLoading } = usePurchaseOrders();
  const pendingOrders = orders.filter((o) =>
    ['sent', 'invoice_received', 'acknowledged', 'partially_received', 'draft'].includes(o.status)
  );

  const [searchParams] = useSearchParams();
  const [selectedPoId, setSelectedPoId] = useState('');
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().slice(0, 10));

  // "Mark as Received" on a PO navigates here with ?poId=… — preselect that
  // PO once the orders load instead of making the user find it again.
  useEffect(() => {
    const poId = searchParams.get('poId');
    if (poId && !selectedPoId && orders.some((o) => o.id === poId)) {
      setSelectedPoId(poId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, searchParams]);
  const [deliveryRef, setDeliveryRef] = useState('');
  const [notes, setNotes] = useState('');
  const [rowData, setRowData] = useState<Record<string, ItemRowData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  const selectedPo = pendingOrders.find((o) => o.id === selectedPoId);

  // Delivery Reference is auto-generated (DN-YYYY-NNNNNN) rather than
  // free-typed, so store keepers never have to invent their own — it
  // regenerates whenever a different PO is selected for receiving.
  useEffect(() => {
    if (!selectedPoId || !companyId) {
      setDeliveryRef('');
      return;
    }
    let cancelled = false;
    getNextDeliveryRef(companyId).then((ref) => {
      if (!cancelled) setDeliveryRef(ref);
    });
    return () => { cancelled = true; };
  }, [selectedPoId, companyId]);

  const handleRowUpdate = useCallback((itemId: string, data: ItemRowData) => {
    setRowData((prev) => ({ ...prev, [itemId]: data }));
  }, []);

  // Queues a supplier email reflecting whatever is currently in the form —
  // quantities, condition, and notes — so a correction made after the
  // receipt was already confirmed (or before submitting at all) can be
  // sent without re-running the stock-affecting transaction. Shared by
  // both Confirm Receipt and the standalone Resend Email button.
  //
  // `onlyIfAllGood` is what Confirm Receipt uses: if even one row in this
  // submission is marked not-good, no email goes out at all — not the
  // thank-you, not a fault notice, nothing — until the discrepancy is
  // resolved and reported via the explicit Resend Email action instead.
  // The thank-you only ever fires on a receipt with zero issues.
  async function sendReceiptEmail(options?: { onlyIfAllGood?: boolean }) {
    if (!selectedPo || !companyId) return false;
    const lines = selectedPo.items
      .map((item) => {
        const row = rowData[item.id];
        return {
          partNumber: item.partNumber,
          partName: item.partName,
          quantity: row?.quantityReceived ?? 0,
          condition: row?.condition ?? 'good',
          notes: row?.notes ?? '',
        };
      })
      .filter((l) => l.quantity > 0);
    const receivedItems = lines.filter((l) => l.condition === 'good');
    const issueItems = lines.filter((l) => l.condition !== 'good');

    if (options?.onlyIfAllGood && issueItems.length > 0) return false;
    const outgoingIssueItems = options?.onlyIfAllGood ? [] : issueItems;

    if (!selectedPo.supplierEmail || (receivedItems.length === 0 && outgoingIssueItems.length === 0)) return false;

    await addDoc(collection(db, 'po_notifications'), {
      companyId,
      poId: selectedPo.id,
      poNumber: selectedPo.poNumber,
      supplierName: selectedPo.supplierName,
      supplierEmail: selectedPo.supplierEmail,
      total: selectedPo.totalOrderValue,
      currency: selectedPo.currency,
      recipients: [],
      event: 'received',
      receivedItems,
      issueItems: outgoingIssueItems,
      deliveryRef,
      receiveDate,
      notes,
      status: 'queued',
      createdAt: serverTimestamp(),
    });
    return true;
  }

  // Resend Email never touches stock — it only re-sends the
  // received/faults notice with whatever is currently in the form. Since a
  // resend implies the receipt needs correcting, it also sends the PO back
  // to "Invoice Received" so it goes through Receive New Stock again rather
  // than staying marked as (partially) received against unconfirmed numbers.
  async function handleResendEmail() {
    if (!selectedPo) return;
    setIsResendingEmail(true);
    try {
      const sent = await sendReceiptEmail();
      if (sent) {
        await updateDoc(doc(db, 'purchaseOrders', selectedPo.id), {
          status: 'invoice_received',
          updatedAt: serverTimestamp(),
        });
        toast.success('Email resent with the current receipt details. PO moved back to Invoice Received.');
      } else {
        toast.error('Nothing to send — add a received/damaged quantity or check the supplier has an email on file.');
      }
    } catch (err) {
      console.error('Failed to resend receipt email', err);
      toast.error('Failed to resend email.');
    } finally {
      setIsResendingEmail(false);
    }
  }

  async function handleSubmit() {
    if (!selectedPo || !userProfile || !companyId) return;
    setIsSubmitting(true);

    try {
      await runTransaction(db, async (tx) => {
        const now = serverTimestamp();

        // Read the PO fresh inside the transaction — receiving against a
        // stale client copy of `items` (from the list snapshot at page
        // load) would clobber any receipt recorded by another user in the
        // meantime, since the whole `items` array gets overwritten below.
        const poRef = doc(db, 'purchaseOrders', selectedPo.id);
        const poSnap = await tx.get(poRef);
        if (!poSnap.exists()) {
          throw new Error('Purchase order no longer exists.');
        }
        const poData = poSnap.data();
        const currentItems = (poData.items as PurchaseOrderItem[]) ?? selectedPo.items;

        // Firestore transactions require every read to happen before any
        // write — reading part N+1 after part N's write was already queued
        // throws "Firestore transactions require all reads to be executed
        // before all writes." So read every affected part first, then queue
        // all the writes in a second pass.
        const receivingItems = currentItems
          .map((item) => {
            const row = rowData[item.id];
            const qty = row?.quantityReceived ?? 0;
            const cost = row?.unitCost ?? item.unitCost;
            const cond = row?.condition ?? 'good';
            return { item, row, qty, cost, cond };
          })
          .filter(({ qty, cond }) => qty > 0 && cond === 'good');

        const partSnaps = await Promise.all(
          receivingItems.map(({ item }) => tx.get(doc(db, 'inventoryParts', item.partId))),
        );

        const updatedItems: PurchaseOrderItem[] = currentItems.map((item) => {
          const row = rowData[item.id];
          const qty = row?.quantityReceived ?? 0;
          return { ...item, quantityReceived: item.quantityReceived + qty };
        });

        receivingItems.forEach(({ item, row, qty, cost }, idx) => {
          const partSnap = partSnaps[idx];
          if (!partSnap.exists()) return;

          const partRef = doc(db, 'inventoryParts', item.partId);
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
            performedBy: userProfile.id ?? '',
            performedByName: userProfile.fullName ?? '',
            performedByRole: userProfile.role ?? '',
            performedAt: now,
            notes: row?.notes ?? '',
            unitCostAtTime: cost,
            totalCostImpact: cost * qty,
          });
        });

        // Update PO status
        const allFullyReceived = updatedItems.every(
          (i) => i.quantityReceived >= i.quantityOrdered
        );
        const anyReceived = updatedItems.some((i) => i.quantityReceived > 0);

        const receiptEntry = {
          // serverTimestamp() is rejected inside array elements (receiptHistory
          // is an array), which made the whole transaction throw and surface as
          // "Failed to record receipt" with no stock update. Use a client
          // Timestamp for the array entry instead.
          receivedAt: Timestamp.now(),
          receivedBy: userProfile.id ?? '',
          receivedByName: userProfile.fullName ?? '',
          receiveDate,
          deliveryRef,
          notes,
        };
        const receiptHistory = [...((poData.receiptHistory as unknown[]) ?? []), receiptEntry];

        tx.update(poRef, {
          items: updatedItems,
          status: allFullyReceived ? 'received' : anyReceived ? 'partially_received' : poData.status,
          receivedAt: allFullyReceived ? now : (poData.receivedAt ?? null),
          receiptHistory,
          updatedAt: now,
        });
      });

      // Export the final PO — with the just-confirmed final costs and a
      // generated timestamp — so the store keeper has a record of exactly
      // what was received and at what price, right at the Received stage.
      try {
        const finalItems: PurchaseOrderItem[] = selectedPo.items.map((item) => {
          const row = rowData[item.id];
          const qty = row?.quantityReceived ?? 0;
          const cost = row?.unitCost ?? item.unitCost;
          return {
            ...item,
            quantityReceived: item.quantityReceived + qty,
            unitCost: cost,
            totalCost: cost * (item.quantityReceived + qty),
          };
        });
        openPOPrintView(
          { ...selectedPo, items: finalItems } as PurchaseOrder,
          {
            name: company?.name ?? 'Company',
            address: (company as any)?.address,
            phone: (company as any)?.phone,
            email: (company as any)?.email,
          },
          {
            approver: selectedPo.approvedByName
              ? { name: selectedPo.approvedByName, role: selectedPo.approvedByRole ?? undefined }
              : undefined,
            generatedAt: new Date(),
          },
        );
      } catch (exportErr) {
        console.error('Failed to export final PO', exportErr);
      }

      // Send the delivery-received thank-you as soon as Confirm Receipt
      // completes, but only when every item in this submission was marked
      // good — if even one is faulty, no email goes out here at all (not
      // the thank-you, not a fault notice). Report the fault afterward via
      // Resend Email instead, once ready. Best effort: a failed email
      // never undoes the stock update above.
      try {
        await sendReceiptEmail({ onlyIfAllGood: true });
      } catch (emailErr) {
        console.error('Failed to queue receipt confirmation email', emailErr);
      }

      toast.success('Stock received successfully');
      setSelectedPoId('');
      setRowData({});
      setDeliveryRef('');
      setNotes('');
      // Close the receive form and land on the catalog, where the live
      // inventory list already reflects the new stock quantities.
      navigate('/app/inventory/catalog');
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to record receipt: ${detail}`);
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
                readOnly
                disabled
                placeholder="Generating…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
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
                  unitCost: item.unitCost,
                }}
                onUpdate={(data) => handleRowUpdate(item.id, data)}
              />
            ))}
          </div>

          {/* Final added costs */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
              <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                <span>Final Cost Total</span>
                <span>
                  {selectedPo.currency}{' '}
                  {selectedPo.items
                    .reduce((sum, item) => {
                      const row = rowData[item.id];
                      const qty = row?.quantityReceived ?? 0;
                      const cost = row?.unitCost ?? item.unitCost;
                      return sum + qty * cost;
                    }, 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
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
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Confirming Receipt…' : 'Confirm Receipt'}
            </button>
            <button
              onClick={handleResendEmail}
              disabled={isResendingEmail || isSubmitting}
              title="Send the supplier an email with whatever is currently in this form — use this if you've changed a quantity, condition, or note after already confirming a receipt"
              className="sm:flex-none px-5 py-3 rounded-xl bg-white border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isResendingEmail ? 'Sending…' : 'Resend Email'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
