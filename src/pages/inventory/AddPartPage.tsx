import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, Save, PlusCircle } from 'lucide-react';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { createPartSchema, type CreatePartFormValues } from '@/schemas/inventory';
import { useToast } from '@/hooks/useToast';
import { StockGauge } from '@/components/inventory/shared/StockGauge';
import { generatePartNumber } from '@/lib/inventory/poNumberGenerator';

const CATEGORIES = [
  'bearings', 'belts_chains', 'bolts_fasteners', 'electrical', 'filters',
  'gaskets_seals', 'gears_sprockets', 'hydraulic', 'lubricants_oils',
  'motors_drives', 'pneumatic', 'pumps_valves', 'safety_equipment',
  'sensors_instrumentation', 'welding_supplies', 'other',
] as const;

const UNITS = ['pcs', 'set', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'box', 'roll', 'pair', 'bag', 'drum'] as const;

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide text-blue-700">{title}</h3>
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

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export function AddPartPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const canViewCost = useAuthStore((s) => s.canAccess(['store_keeper', 'supervisor', 'plant_manager', 'admin']));
  const [saving, setSaving] = useState(false);
  const [addAnother, setAddAnother] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreatePartFormValues>({
    resolver: zodResolver(createPartSchema) as any,
    defaultValues: {
      status: 'active',
      criticality: 'medium',
      currentStock: 0,
      minStockLevel: 0,
      maxStockLevel: 0,
      unitCost: 0,
      leadTimeDays: 0,
      lastPurchasePrice: 0,
      warrantyMonths: 0,
      compatibleMachineIds: [],
      notes: '',
    },
  });

  const currentStock = watch('currentStock');
  const minStock = watch('minStockLevel');
  const maxStock = watch('maxStockLevel');

  async function suggestPartNumber() {
    if (!companyId) return;
    const q = query(
      collection(db, 'inventoryParts'),
      where('companyId', '==', companyId),
      orderBy('partNumber', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    let nextSeq = 1;
    if (!snap.empty) {
      const last = snap.docs[0].data().partNumber as string;
      const match = last.match(/(\d+)$/);
      if (match) nextSeq = parseInt(match[1], 10) + 1;
    }
    setValue('partNumber', generatePartNumber('PRT', nextSeq));
  }

  async function onSubmit(values: CreatePartFormValues) {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const partRef = doc(collection(db, 'inventoryParts'));

      batch.set(partRef, {
        ...values,
        id: partRef.id,
        companyId,
        reservedStock: 0,
        availableStock: values.currentStock,
        isCritical: values.criticality === 'critical',
        isLowStock: values.currentStock > 0 && values.minStockLevel > 0 && values.currentStock <= values.minStockLevel,
        cadFiles: [],
        images: [],
        totalUsedAllTime: 0,
        totalCostAllTime: 0,
        lastIssuedAt: null,
        lastReceivedAt: null,
        importedAt: null,
        importedFrom: null,
        lastPurchaseDate: values.lastPurchaseDate ?? null,
        createdAt: serverTimestamp(),
        createdBy: userId,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });

      if (values.currentStock > 0) {
        const movRef = doc(collection(db, 'stockMovements'));
        batch.set(movRef, {
          companyId,
          partId: partRef.id,
          partNumber: values.partNumber,
          partName: values.name,
          movementType: 'adjustment',
          quantityBefore: 0,
          quantityChange: values.currentStock,
          quantityAfter: values.currentStock,
          referenceType: 'manual_adjustment',
          referenceId: partRef.id,
          workOrderId: null,
          workOrderNumber: null,
          partsRequestId: null,
          performedBy: userId,
          performedByName: '',
          performedByRole: '',
          performedAt: serverTimestamp(),
          notes: 'Initial stock on part creation',
          unitCostAtTime: values.unitCost,
          totalCostImpact: values.currentStock * values.unitCost,
        });
      }

      await batch.commit();
      addToast('Part created successfully.', 'success');

      if (addAnother) {
        reset();
      } else {
        navigate(`/app/inventory/catalog/${partRef.id}`);
      }
    } catch (err) {
      addToast('Failed to create part.', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/app/inventory/catalog"
          className="text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Add New Part</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-5" noValidate>
        {/* 1. Identification */}
        <SectionCard title="1 · Identification">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Part Number" required error={errors.partNumber?.message}>
              <div className="flex gap-2">
                <input {...register('partNumber')} className={inputCls} placeholder="PRT-0001" />
                <button
                  type="button"
                  onClick={suggestPartNumber}
                  className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 whitespace-nowrap"
                >
                  Auto
                </button>
              </div>
            </Field>
            <Field label="Name" required error={errors.name?.message}>
              <input {...register('name')} className={inputCls} placeholder="Part name" />
            </Field>
            <Field label="Category" required error={errors.category?.message}>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <select {...field} className={inputCls}>
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                )}
              />
            </Field>
            <Field label="Unit" required error={errors.unit?.message}>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <select {...field} className={inputCls}>
                    <option value="">Select unit</option>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                )}
              />
            </Field>
            <Field label="Status" error={errors.status?.message}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <select {...field} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                )}
              />
            </Field>
            <Field label="Criticality" error={errors.criticality?.message}>
              <Controller
                name="criticality"
                control={control}
                render={({ field }) => (
                  <select {...field} className={inputCls}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                )}
              />
            </Field>
          </div>
        </SectionCard>

        {/* 2. Stock Levels */}
        <SectionCard title="2 · Stock Levels">
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
            <input {...register('storeLocation')} className={inputCls} placeholder="Shelf A3, Bin 12…" />
          </Field>
          <div className="pt-2">
            <p className="text-xs text-gray-500 mb-2">Stock level preview</p>
            <StockGauge
              current={currentStock}
              min={minStock}
              max={maxStock}
              unit={watch('unit')}
            />
          </div>
        </SectionCard>

        {/* 3. Details */}
        <SectionCard title="3 · Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Brand">
              <input {...register('brand')} className={inputCls} placeholder="Brand name" />
            </Field>
            <Field label="Model Reference">
              <input {...register('modelRef')} className={inputCls} placeholder="Model / part code" />
            </Field>
            <Field label="Warranty (Months)">
              <input type="number" min="0" {...register('warrantyMonths', { valueAsNumber: true })} className={inputCls} />
            </Field>
          </div>
          <Field label="Description">
            <textarea {...register('description')} rows={3} className={`${inputCls} resize-none`} placeholder="Optional description…" />
          </Field>
        </SectionCard>

        {/* 4. Supplier & Pricing */}
        <SectionCard title="4 · Supplier &amp; Pricing">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {canViewCost && (
              <Field label="Unit Cost (LKR)" error={errors.unitCost?.message}>
                <input type="number" min="0" step="0.01" {...register('unitCost', { valueAsNumber: true })} className={inputCls} />
              </Field>
            )}
            <Field label="Supplier Name">
              <input {...register('supplierName')} className={inputCls} placeholder="Supplier" />
            </Field>
            <Field label="Supplier Contact">
              <input {...register('supplierContact')} className={inputCls} placeholder="Email / phone" />
            </Field>
            <Field label="Supplier Part Code">
              <input {...register('supplierPartCode')} className={inputCls} placeholder="Supplier's part #" />
            </Field>
            <Field label="Lead Time (Days)">
              <input type="number" min="0" {...register('leadTimeDays', { valueAsNumber: true })} className={inputCls} />
            </Field>
            <Field label="Last Purchase Date">
              <input type="date" {...register('lastPurchaseDate')} className={inputCls} />
            </Field>
            {canViewCost && (
              <Field label="Last Purchase Price (LKR)">
                <input type="number" min="0" step="0.01" {...register('lastPurchasePrice', { valueAsNumber: true })} className={inputCls} />
              </Field>
            )}
          </div>
        </SectionCard>

        {/* 5. Notes */}
        <SectionCard title="5 · Notes">
          <Field label="Notes">
            <textarea {...register('notes')} rows={4} className={`${inputCls} resize-none`} placeholder="Any additional notes…" />
          </Field>
        </SectionCard>

        {/* Footer */}
        <div className="flex flex-wrap gap-3 pb-8">
          <button
            type="submit"
            disabled={saving}
            onClick={() => setAddAnother(false)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            Save Part
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={() => setAddAnother(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-xl transition-colors text-sm disabled:opacity-60"
          >
            <PlusCircle className="w-4 h-4" />
            Save &amp; Add Another
          </button>
          <Link
            to="/app/inventory/catalog"
            className="inline-flex items-center justify-center px-5 py-3 text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
export default AddPartPage;
