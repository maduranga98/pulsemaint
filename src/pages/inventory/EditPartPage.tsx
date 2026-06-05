import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, Save } from 'lucide-react';
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { createPartSchema, type CreatePartFormValues } from '@/schemas/inventory';
import { useInventoryPart } from '@/hooks/inventory/useInventoryPart';
import { useToast } from '@/hooks/useToast';
import { StockGauge } from '@/components/inventory/shared/StockGauge';

const CATEGORIES = [
  'bearings', 'belts_chains', 'bolts_fasteners', 'electrical', 'filters',
  'gaskets_seals', 'gears_sprockets', 'hydraulic', 'lubricants_oils',
  'motors_drives', 'pneumatic', 'pumps_valves', 'safety_equipment',
  'sensors_instrumentation', 'welding_supplies', 'other',
] as const;

const UNITS = ['pcs', 'set', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'box', 'roll', 'pair', 'bag', 'drum'] as const;

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-blue-700">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function EditPartPage() {
  const { partId } = useParams<{ partId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const canViewCost = useAuthStore((s) => s.canAccess(['store_keeper', 'supervisor', 'plant_manager', 'admin']));
  const isTechnician = useAuthStore((s) => s.isTechnician);

  const { part, loading, error } = useInventoryPart(partId);
  const [saving, setSaving] = useState(false);

  // Stock adjustment modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [pendingValues, setPendingValues] = useState<CreatePartFormValues | null>(null);
  const [adjustReason, setAdjustReason] = useState('');

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<CreatePartFormValues>({
    resolver: zodResolver(createPartSchema) as any,
    values: part
      ? {
          partNumber: part.partNumber,
          name: part.name,
          description: part.description,
          brand: part.brand,
          modelRef: part.modelRef,
          category: part.category,
          unit: part.unit,
          status: part.status,
          criticality: part.criticality,
          currentStock: part.currentStock,
          minStockLevel: part.minStockLevel,
          maxStockLevel: part.maxStockLevel,
          unitCost: part.unitCost,
          storeLocation: part.storeLocation,
          supplierName: part.supplierName,
          supplierContact: part.supplierContact,
          supplierPartCode: part.supplierPartCode,
          leadTimeDays: part.leadTimeDays,
          lastPurchaseDate: part.lastPurchaseDate
            ? part.lastPurchaseDate.toDate
              ? part.lastPurchaseDate.toDate().toISOString().split('T')[0]
              : null
            : null,
          lastPurchasePrice: part.lastPurchasePrice,
          warrantyMonths: part.warrantyMonths,
          compatibleMachineIds: part.compatibleMachineIds,
          notes: part.notes,
        }
      : undefined,
  });

  const currentStock = watch('currentStock');
  const minStock = watch('minStockLevel');
  const maxStock = watch('maxStockLevel');

  if (isTechnician) {
    navigate('/app/inventory/catalog');
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        {[1, 2, 3].map((k) => <div key={k} className="h-32 bg-gray-100 rounded-xl" />)}
      </div>
    );
  }

  if (error || !part) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        {error ?? 'Part not found.'}
      </div>
    );
  }

  async function doSave(values: CreatePartFormValues) {
    if (!part) return;
    setSaving(true);
    try {
      const stockChanged = values.currentStock !== part.currentStock;

      await updateDoc(doc(db, 'inventoryParts', part.id), {
        ...values,
        isLowStock: values.currentStock > 0 && values.minStockLevel > 0 && values.currentStock <= values.minStockLevel,
        isCritical: values.criticality === 'critical',
        availableStock: values.currentStock - part.reservedStock,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });

      if (stockChanged) {
        const change = values.currentStock - part.currentStock;
        await addDoc(collection(db, 'stockMovements'), {
          companyId,
          partId: part.id,
          partNumber: part.partNumber,
          partName: part.name,
          movementType: 'adjustment',
          quantityBefore: part.currentStock,
          quantityChange: change,
          quantityAfter: values.currentStock,
          referenceType: 'manual_adjustment',
          referenceId: part.id,
          workOrderId: null,
          workOrderNumber: null,
          partsRequestId: null,
          performedBy: userId,
          performedByName: '',
          performedByRole: '',
          performedAt: serverTimestamp(),
          notes: adjustReason || 'Manual stock adjustment via edit',
          unitCostAtTime: values.unitCost,
          totalCostImpact: Math.abs(change) * values.unitCost,
        });
      }

      addToast('Part updated successfully.', 'success');
      navigate(`/app/inventory/catalog/${part.id}`);
    } catch (err) {
      addToast('Failed to update part.', 'error');
      console.error(err);
    } finally {
      setSaving(false);
      setShowAdjustModal(false);
    }
  }

  function onSubmit(values: CreatePartFormValues) {
    if (part && values.currentStock !== part.currentStock) {
      setPendingValues(values);
      setShowAdjustModal(true);
    } else {
      doSave(values);
    }
  }

  return (
    <>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Link to={`/app/inventory/catalog/${part.id}`} className="text-gray-400 hover:text-gray-700">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Edit Part</h1>
          <span className="font-mono text-sm text-gray-500">{part.partNumber}</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-5" noValidate>
          <SectionCard title="Identification">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Part Number" required error={errors.partNumber?.message}>
                <input {...register('partNumber')} className={inputCls} />
              </Field>
              <Field label="Name" required error={errors.name?.message}>
                <input {...register('name')} className={inputCls} />
              </Field>
              <Field label="Category" required error={errors.category?.message}>
                <Controller name="category" control={control} render={({ field }) => (
                  <select {...field} className={inputCls}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                )} />
              </Field>
              <Field label="Unit" required error={errors.unit?.message}>
                <Controller name="unit" control={control} render={({ field }) => (
                  <select {...field} className={inputCls}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                )} />
              </Field>
              <Field label="Status">
                <Controller name="status" control={control} render={({ field }) => (
                  <select {...field} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                )} />
              </Field>
              <Field label="Criticality">
                <Controller name="criticality" control={control} render={({ field }) => (
                  <select {...field} className={inputCls}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                )} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Stock Levels">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Current Stock" error={errors.currentStock?.message}>
                <input type="number" min="0" step="0.001" {...register('currentStock', { valueAsNumber: true })} className={inputCls} />
              </Field>
              <Field label="Min Stock Level" error={errors.minStockLevel?.message}>
                <input type="number" min="0" {...register('minStockLevel', { valueAsNumber: true })} className={inputCls} />
              </Field>
              <Field label="Max Stock Level" error={errors.maxStockLevel?.message}>
                <input type="number" min="0" {...register('maxStockLevel', { valueAsNumber: true })} className={inputCls} />
              </Field>
            </div>
            <Field label="Store Location">
              <input {...register('storeLocation')} className={inputCls} />
            </Field>
            <StockGauge current={currentStock} min={minStock} max={maxStock} unit={watch('unit')} />
          </SectionCard>

          <SectionCard title="Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Brand"><input {...register('brand')} className={inputCls} /></Field>
              <Field label="Model Reference"><input {...register('modelRef')} className={inputCls} /></Field>
              <Field label="Warranty (Months)">
                <input type="number" min="0" {...register('warrantyMonths', { valueAsNumber: true })} className={inputCls} />
              </Field>
            </div>
            <Field label="Description">
              <textarea {...register('description')} rows={3} className={`${inputCls} resize-none`} />
            </Field>
          </SectionCard>

          {canViewCost && (
            <SectionCard title="Supplier &amp; Pricing">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Unit Cost (LKR)">
                  <input type="number" min="0" step="0.01" {...register('unitCost', { valueAsNumber: true })} className={inputCls} />
                </Field>
                <Field label="Supplier Name"><input {...register('supplierName')} className={inputCls} /></Field>
                <Field label="Supplier Contact"><input {...register('supplierContact')} className={inputCls} /></Field>
                <Field label="Supplier Part Code"><input {...register('supplierPartCode')} className={inputCls} /></Field>
                <Field label="Lead Time (Days)">
                  <input type="number" min="0" {...register('leadTimeDays', { valueAsNumber: true })} className={inputCls} />
                </Field>
                <Field label="Last Purchase Date">
                  <input type="date" {...register('lastPurchaseDate')} className={inputCls} />
                </Field>
                <Field label="Last Purchase Price (LKR)">
                  <input type="number" min="0" step="0.01" {...register('lastPurchasePrice', { valueAsNumber: true })} className={inputCls} />
                </Field>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Notes">
            <Field label="Notes">
              <textarea {...register('notes')} rows={4} className={`${inputCls} resize-none`} />
            </Field>
          </SectionCard>

          <div className="flex flex-wrap gap-3 pb-8">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
            <Link
              to={`/app/inventory/catalog/${part.id}`}
              className="inline-flex items-center justify-center px-5 py-3 text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* Stock adjustment reason modal */}
      {showAdjustModal && pendingValues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Stock Quantity Changed</h3>
            <p className="text-sm text-gray-600">
              Stock changed from <strong>{part.currentStock}</strong> to <strong>{pendingValues.currentStock}</strong>.
              Please provide a reason for this adjustment.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Reason for stock adjustment…"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAdjustModal(false); setPendingValues(null); }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => doSave(pendingValues)}
                disabled={!adjustReason.trim() || saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default EditPartPage;
