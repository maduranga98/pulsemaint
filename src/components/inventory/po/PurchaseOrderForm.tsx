import { useState } from 'react';
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
  const userRole = useAuthStore((s) => s.userProfile?.role) ?? '';

  const canApprove = userRole === 'plant_manager' || userRole === 'admin';

  const [items, setItems] = useState<POItemRowData[]>(
    initialPO?.items.map((i) => ({
      partId: i.partId,
      partNumber: i.partNumber,
      partName: i.partName,
      quantityOrdered: i.quantityOrdered,
      unitCost: i.unitCost,
      leadTimeDays: i.leadTimeDays,
      expectedDelivery: i.expectedDelivery
        ? (i.expectedDelivery as any).toDate
          ? (i.expectedDelivery as any).toDate().toISOString().split('T')[0]
          : null
        : null,
    })) ?? [emptyItem()],
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
      supplierContactPerson: initialPO?.supplierContactPerson ?? '',
      supplierPhone: initialPO?.supplierPhone ?? '',
      supplierEmail: initialPO?.supplierEmail ?? '',
      supplierAddress: initialPO?.supplierAddress ?? '',
      deliveryAddress: initialPO?.deliveryAddress ?? '',
      paymentTerms: initialPO?.paymentTerms ?? '',
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
      limit(1),
    );
    const snap = await getDocs(q);
    const lastSeq = snap.empty
      ? 0
      : parseInt(snap.docs[0].data().poNumber?.split('-').pop() ?? '0', 10);
    return generatePONumber('PO', year, lastSeq + 1);
  }

  async function queueEmail(po: PurchaseOrder) {
    // Notify plant managers + admins. A backend worker / Cloud Function
    // should consume this collection and dispatch the email.
    try {
      const usersSnap = await getDocs(
        query(collection(db, `companies/${companyId}/users`), where('role', 'in', ['plant_manager', 'admin'])),
      );
      const recipients = usersSnap.docs
        .map((d) => (d.data() as any).email as string | undefined)
        .filter(Boolean) as string[];

      if (recipients.length === 0) return;

      await addDoc(collection(db, 'po_notifications'), {
        companyId,
        poId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        supplierEmail: po.supplierEmail ?? '',
        total: po.totalOrderValue,
        currency: po.currency,
        recipients,
        event: po.status,
        status: 'queued',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to queue PO email notification', err);
    }
  }

  async function save(values: PurchaseOrderFormValues, status: PurchaseOrderStatus) {
    if (items.length === 0 || items.some((i) => !i.partId || i.quantityOrdered <= 0)) {
      addToast('Add at least one item with a part and quantity.', 'error');
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

      const supplierFields = {
        supplierName: values.supplierName,
        supplierContact: values.supplierContact,
        supplierContactPerson: values.supplierContactPerson ?? '',
        supplierPhone: values.supplierPhone ?? '',
        supplierEmail: values.supplierEmail ?? '',
        supplierAddress: values.supplierAddress ?? '',
        deliveryAddress: values.deliveryAddress ?? '',
        paymentTerms: values.paymentTerms ?? '',
        currency: values.currency,
      };

      if (initialPO) {
        const ref = doc(db, 'purchaseOrders', initialPO.id);
        await updateDoc(ref, {
          ...supplierFields,
          items: poItems,
          totalOrderValue: totalValue,
          notes: values.notes,
          status,
          updatedAt: serverTimestamp(),
        });
        const updated = {
          ...initialPO,
          ...supplierFields,
          items: poItems as PurchaseOrder['items'],
          status,
          totalOrderValue: totalValue,
          notes: values.notes,
        } as PurchaseOrder;
        onSave(updated);
        if (status === 'pending_approval' || status === 'sent') await queueEmail(updated);
      } else {
        const poNumber = await generatePONum();
        const payload = {
          companyId,
          poNumber,
          status,
          ...supplierFields,
          items: poItems,
          totalOrderValue: totalValue,
          totalReceivedValue: 0,
          raisedBy: userId,
          raisedByName: userName,
          raisedByRole: userRole,
          raisedAt: serverTimestamp(),
          approvedBy: null,
          approvedByName: null,
          approvedAt: null,
          rejectedReason: null,
          sentAt: status === 'sent' ? serverTimestamp() : null,
          acknowledgedAt: null,
          receivedAt: null,
          notes: values.notes,
          attachments: [],
        };
        const ref = await addDoc(collection(db, 'purchaseOrders'), payload);
        const created = { id: ref.id, ...payload } as unknown as PurchaseOrder;
        onSave(created);
        if (status === 'pending_approval' || status === 'sent') await queueEmail(created);
      }
      const msg =
        status === 'draft'
          ? 'PO saved as draft.'
          : status === 'pending_approval'
            ? 'PO submitted for approval.'
            : 'PO saved and sent.';
      addToast(msg, 'success');
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
          <div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input
              {...register('supplierContactPerson')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Salesperson name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              {...register('supplierPhone')}
              type="tel"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+94 ..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              {...register('supplierEmail')}
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="supplier@example.com"
            />
            {errors.supplierEmail && (
              <p className="text-xs text-red-600 mt-1">{errors.supplierEmail.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Other Contact</label>
            <input
              {...register('supplierContact')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Fax, alt phone, etc."
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Address</label>
            <textarea
              {...register('supplierAddress')}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery / Ship-To Address</label>
            <textarea
              {...register('deliveryAddress')}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
          <input
            {...register('paymentTerms')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Net 30, 50% advance"
          />
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
          onClick={handleSubmit((v) => save(v, 'pending_approval'))}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
          Submit for Approval
        </button>
        {canApprove && (
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit((v) => save(v, 'sent'))}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            Approve &amp; Send
          </button>
        )}
      </div>
    </form>
  );
}
