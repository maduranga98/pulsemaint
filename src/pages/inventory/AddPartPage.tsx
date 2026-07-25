import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, Save, PlusCircle } from 'lucide-react';
import {
  collection,
  serverTimestamp,
  writeBatch,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { createPartSchema, type CreatePartFormValues } from '@/schemas/inventory';
import { useToast } from '@/hooks/useToast';
import { StockGauge } from '@/components/inventory/shared/StockGauge';
import { CategorySelect } from '@/components/inventory/shared/CategorySelect';
import { useSuppliers } from '@/hooks/inventory/useSuppliers';
import { getNextCategoryPartNumber } from '@/lib/inventory/partNumberGenerator';
import { categoryPrefixLetter } from '@/lib/inventory/inventoryTypes';
import type { WarrantyDocument } from '@/types/inventory';

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
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? '';
  const userRole = useAuthStore((s) => s.userProfile?.role) ?? '';
  const canViewCost = useAuthStore((s) => s.canAccess(['store_keeper', 'supervisor', 'plant_manager', 'admin']));
  const { suppliers } = useSuppliers();
  const [saving, setSaving] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const [warrantyFiles, setWarrantyFiles] = useState<File[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

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
  const selectedCategory = watch('category');

  async function onSubmit(values: CreatePartFormValues) {
    setSaving(true);
    try {
      const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);
      const partNumber = await getNextCategoryPartNumber(companyId, {
        category: values.category,
        supplierCode: selectedSupplier?.supplierCode,
        storeLocation: values.storeLocation,
      });
      // Auto-fill with the generated part number when left blank, so the
      // field is never empty even if the supplier hasn't provided their own code yet.
      const supplierPartCode = values.supplierPartCode || partNumber;

      const batch = writeBatch(db);
      const partRef = doc(collection(db, 'inventoryParts'));

      batch.set(partRef, {
        ...values,
        partNumber,
        supplierPartCode,
        supplierId: selectedSupplierId,
        id: partRef.id,
        companyId,
        reservedStock: 0,
        availableStock: values.currentStock,
        isCritical: values.criticality === 'critical',
        isLowStock: values.currentStock > 0 && values.minStockLevel > 0 && values.currentStock <= values.minStockLevel,
        cadFiles: [],
        images: [],
        warrantyDocuments: [],
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
          partNumber,
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
          performedByName: userName,
          performedByRole: userRole,
          performedAt: serverTimestamp(),
          notes: 'Initial stock on part creation',
          unitCostAtTime: values.unitCost,
          totalCostImpact: values.currentStock * values.unitCost,
        });
      }

      await batch.commit();

      // The part (and its initial stock movement) are already saved at this
      // point — a warranty upload failure below must not be reported as a
      // failed part creation.
      addToast(`Part ${partNumber} created successfully.`, 'success');

      if (warrantyFiles.length > 0) {
        try {
          const uploaded: WarrantyDocument[] = [];
          for (const file of warrantyFiles) {
            const path = `inventoryParts/${partRef.id}/warranty/${Date.now()}_${file.name}`;
            const sref = storageRef(storage, path);
            await uploadBytes(sref, file);
            const url = await getDownloadURL(sref);
            uploaded.push({
              name: file.name,
              url,
              uploadedAt: Timestamp.now(),
              uploadedBy: userId,
              fileSizeBytes: file.size,
            });
          }
          await updateDoc(partRef, { warrantyDocuments: uploaded });
        } catch (uploadErr) {
          console.error(uploadErr);
          addToast('Part saved, but warranty file upload failed. You can attach it from the part page.', 'warning');
        }
      }

      if (addAnother) {
        reset();
        setWarrantyFiles([]);
        setSelectedSupplierId('');
      } else {
        navigate('/app/inventory/catalog');
      }
    } catch (err) {
      // Surface the real cause (e.g. a Firestore permission-denied error)
      // instead of a generic message, so a failed save is diagnosable.
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Failed to create part: ${message}`, 'error');
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
            <Field label="Part Number">
              <input
                readOnly
                disabled
                value={
                  selectedCategory
                    ? `Auto-generated (${categoryPrefixLetter(selectedCategory)}-xxx-xxx-0001)`
                    : 'Select a category to preview format'
                }
                className={`${inputCls} bg-gray-50 text-gray-500`}
              />
              <p className="text-xs text-gray-400 mt-1">
                Assigned automatically on save: Category-Supplier-Location-Sequence
                (e.g. Electrical, Supplier SUP-LK-000012, Rack A Shelf 2 → E-012-RAS-0001).
              </p>
            </Field>
            <Field label="Name" required error={errors.name?.message}>
              <input {...register('name')} className={inputCls} placeholder="Part name" />
            </Field>
            <Field label="Category" required error={errors.category?.message}>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <CategorySelect value={field.value ?? ''} onChange={field.onChange} required className={inputCls} />
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
          <Field label="Warranty Documents / Images (optional)">
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => setWarrantyFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100"
            />
            {warrantyFiles.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{warrantyFiles.length} file(s) selected</p>
            )}
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
            <Field label="Supplier" error={errors.supplierName?.message}>
              {suppliers.length > 0 ? (
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    const supplierId = e.target.value;
                    setSelectedSupplierId(supplierId);
                    const supplier = suppliers.find((s) => s.id === supplierId);
                    setValue('supplierName', supplier?.name ?? '');
                    setValue('supplierContact', supplier ? [supplier.phone, supplier.email].filter(Boolean).join(' / ') : '');
                  }}
                  className={inputCls}
                >
                  <option value="">Select a supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-500">
                  No suppliers yet.{' '}
                  <Link to="/app/inventory/suppliers" className="text-blue-600 hover:underline">
                    Add a supplier
                  </Link>{' '}
                  first, then it'll be selectable here.
                </p>
              )}
            </Field>
            <Field label="Supplier Contact">
              <input {...register('supplierContact')} readOnly disabled className={`${inputCls} bg-gray-50 text-gray-500`} placeholder="From selected supplier" />
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
