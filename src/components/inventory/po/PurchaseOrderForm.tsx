import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save, Send } from 'lucide-react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { purchaseOrderSchema, type PurchaseOrderFormValues } from '@/schemas/inventory';
import type { PurchaseOrder, InventoryCurrency, PurchaseOrderStatus } from '@/types/inventory';
import { generatePONumber } from '@/lib/inventory/poNumberGenerator';
import { useToast } from '@/hooks/useToast';
import { PurchaseOrderItemRow, type POItemRowData } from './PurchaseOrderItemRow';

interface PurchaseOrderFormProps {
  initialPO?: PurchaseOrder;
  onSave: (saved: PurchaseOrder) => void;
}

const CURRENCY_OPTIONS: InventoryCurrency[] = ['LKR', 'USD', 'SGD', 'Other'];

const emptyItem = (): POItemRowData => ({
  partId: '',
  partNumber: '',
  partName: '',
  quantityOrdered: 0,
  unitCost: 0,
  leadTimeDays: 0,
  expectedDelivery: null,
});

export function PurchaseOrderForm({ initialPO, onSave }: PurchaseOrderFormProps) {
  const { addToast } = useToast();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.name) ?? '';

  const [items, setItems] = useState<POItemRowData[]>(
    initialPO?.items.map((i) => ({
      partId: i.partId,
      partNumber: i.partNumber,
      partName: i.partName,
      quantityOrdered: i.quantityOrdered,
      unitCost: i.unitCost,
      leadTimeDays: i.leadTimeDays,
      expectedDelivery: i.expectedDelivery
        ? i.expectedDelivery.toDate
          ? i.expectedDelivery.toDate().toISOString().split('T')[0]
          : null
        : null,
    })) ?? [emptyItem()]
  );
  const [saving, setSaving] = useState(false);

  const totalValue = items.reduce((sum, it) => sum + it.quantityOrdered * it.unitCost, 0);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierName: initialPO?.supplierName ?? '',
      supplierContact: initialPO?.supplierContact ?? '',
      currency: initialPO?.currency ?? 'LKR',
      items: [],
      notes: initialPO?.notes ?? '',
    },
  });

  async function generatePONum(): Promise<string> {
    const year = new Date().getFullYear();
    const q = query(
      collection(db, 'purchaseOrders'),
      where('companyId', '==', companyId),
      orderBy('raisedAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    const lastSeq = snap.empty
      ? 0
      : parseInt(snap.docs[0].data().poNumber?.split('-').pop() ?? '0', 10);
    return generatePONumber('PO', year, lastSeq + 1);
  }

  async function save(values: PurchaseOrderFormValues, status: PurchaseOrderStatus) {
    if (items.length === 0 || items.some((i) => !i.partId)) {
      addToast('Add at least one part to the PO.', 'error');
      return;
    }
    setSaving(true);
    try {
      const poItems = items.map((it, idx) => ({
        id: `item-${idx}`,
        partId: it.partId,
        partNumber: it.partNumber,
        partName: it.partName,
        quantityOrdered: it.quantityOrdered,
        quantityReceived: 0,
        unitCost: it.unitCost,
        totalCost: it.quantityOrdered * it.unitCost,
        leadTimeDays: it.leadTimeDays,
        expectedDelivery: null,
      }));

      if (initialPO) {
        const ref = doc(db, 'purchaseOrders', initialPO.id);
        await updateDoc(ref, {
          supplierName: values.supplierName,
          supplierContact: values.supplierContact,
          currency: values.currency,
          items: poItems,
          totalOrderValue: totalValue,
          notes: values.notes,
          status,
          updatedAt: serverTimestamp(),
        });
        onSave({ ...initialPO, ...values, items: poItems as PurchaseOrder['items'], status, totalOrderValue: totalValue });
      } else {
        const poNumber = await generatePONum();
        const payload = {
          companyId,
          poNumber,
          status,
          supplierName: values.supplierName,
          supplierContact: values.supplierContact,
          currency: values.currency,
          items: poItems,
          totalOrderValue: totalValue,
          totalReceivedValue: 0,
          raisedBy: userId,
          raisedByName: userName,
          raisedAt: serverTimestamp(),
          sentAt: status === 'sent' ? serverTimestamp() : null,
          acknowledgedAt: null,
          receivedAt: null,
          notes: values.notes,
          attachments: [],
        };
        const ref = await addDoc(collection(db, 'purchaseOrders'), payload);
        onSave({ id: ref.id, ...payload } as unknown as PurchaseOrder);
      }
      addToast(status === 'draft' ? 'PO saved as draft.' : 'PO saved and sent.', 'success');
    } catch (err) {
      addToast('Failed to save purchase order.', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function updateItem(idx: number, data: POItemRowData) {
    setItems((prev) => prev.map((it, i) => (i === idx ? data : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <form
      onSubmit={handleSubmit((v) => save(v, 'draft'))}
      className="space-y-6"
      noValidate
    >
      {/* Supplier info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Supplier Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name *</label>
            <input
              {...register('supplierName')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Supplier name"
            />
            {errors.supplierName && (
              <p className="text-xs text-red-600 mt-1">{errors.supplierName.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input
              {...register('supplierContact')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Email / phone"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Order Items</h3>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
            No items added. Click "Add Item" to begin.
          </p>
        )}

        {items.map((item, idx) => (
          <PurchaseOrderItemRow
            key={idx}
            index={idx}
            value={item}
            onUpdate={(data) => updateItem(idx, data)}
            onRemove={() => removeItem(idx)}
          />
        ))}

        {items.length > 0 && (
          <div className="flex justify-end">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-3 text-right">
              <p className="text-xs text-gray-500">Total Order Value</p>
              <p className="text-xl font-bold text-gray-900">
                LKR {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          {...register('notes')}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Additional notes for this purchase order…"
        />
      </div>

      {/* Footer actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          Save as Draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit((v) => save(v, 'sent'))}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
          Save &amp; Send
        </button>
      </div>
    </form>
  );
}
