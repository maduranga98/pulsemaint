import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { checkCanCreate } from '../hooks/usePlanLimitCheck';
import { getNextCategoryPartNumber } from '../lib/inventory/partNumberGenerator';
import type { SparePartEntry } from '../lib/machineSpareParts';

interface SyncArgs {
  companyId: string;
  plantId: string | null;
  machineId: string;
  entries: SparePartEntry[];
  user: { id: string; name: string; role: string };
}

/**
 * Makes the machine's spare parts match `entries`:
 *  - new rows become real inventory parts (auto part number, initial stock
 *    movement), already linked to this machine;
 *  - existing inventory parts picked for the machine get linked;
 *  - parts that were linked but are no longer listed are unlinked (never deleted).
 */
export async function syncMachineSpareParts({ companyId, plantId, machineId, entries, user }: SyncArgs): Promise<void> {
  // New rows become inventory parts, so they count against the plan's inventory limit.
  const newRows = entries.filter((e) => !e.partId).length;
  if (newRows > 0) {
    const limitMessage = await checkCanCreate('inventoryItems', useAuthStore.getState().company, companyId, newRows);
    if (limitMessage) throw new Error(limitMessage);
  }

  const snap = await getDocs(query(collection(db, 'inventoryParts'), where('companyId', '==', companyId)));
  const linkedNow = new Set<string>();
  snap.forEach((d) => {
    if (((d.data().compatibleMachineIds as string[] | undefined) ?? []).includes(machineId)) linkedNow.add(d.id);
  });

  const keepIds = new Set(entries.filter((e) => e.partId).map((e) => e.partId as string));

  // Link picked existing parts, unlink the removed ones.
  const batch = writeBatch(db);
  keepIds.forEach((id) => {
    if (!linkedNow.has(id)) batch.update(doc(db, 'inventoryParts', id), { compatibleMachineIds: arrayUnion(machineId), updatedAt: serverTimestamp(), updatedBy: user.id });
  });
  linkedNow.forEach((id) => {
    if (!keepIds.has(id)) batch.update(doc(db, 'inventoryParts', id), { compatibleMachineIds: arrayRemove(machineId), updatedAt: serverTimestamp(), updatedBy: user.id });
  });
  await batch.commit();

  // New parts one at a time so each gets the next free part number.
  for (const e of entries.filter((x) => !x.partId)) {
    const partNumber = e.partNumber.trim() || (await getNextCategoryPartNumber(companyId, { category: e.category, storeLocation: '' }));
    const partRef = doc(collection(db, 'inventoryParts'));
    const stock = Math.max(0, Number(e.currentStock) || 0);
    const min = Math.max(0, Number(e.minStockLevel) || 0);
    const unitCost = Math.max(0, Number(e.unitCost) || 0);
    const b = writeBatch(db);
    b.set(partRef, {
      id: partRef.id,
      companyId,
      plantId,
      partNumber,
      name: e.name.trim(),
      description: '',
      brand: '',
      modelRef: '',
      category: e.category,
      unit: e.unit,
      status: 'active',
      criticality: 'medium',
      currentStock: stock,
      minStockLevel: min,
      maxStockLevel: 0,
      reservedStock: 0,
      availableStock: stock,
      unitCost,
      lastPurchasePrice: 0,
      lastPurchaseDate: null,
      storeLocation: '',
      supplierId: '',
      supplierName: '',
      supplierContact: '',
      supplierPartCode: partNumber,
      leadTimeDays: 0,
      compatibleMachineIds: [machineId],
      warrantyMonths: 0,
      warrantyDocuments: [],
      cadFiles: [],
      images: [],
      isCritical: false,
      isLowStock: stock > 0 && min > 0 && stock <= min,
      totalUsedAllTime: 0,
      totalCostAllTime: 0,
      lastIssuedAt: null,
      lastReceivedAt: null,
      importedAt: null,
      importedFrom: null,
      notes: 'Added as a machine spare part',
      createdAt: serverTimestamp(),
      createdBy: user.id,
      updatedAt: serverTimestamp(),
      updatedBy: user.id,
    });
    if (stock > 0) {
      b.set(doc(collection(db, 'stockMovements')), {
        companyId,
        partId: partRef.id,
        partNumber,
        partName: e.name.trim(),
        movementType: 'adjustment',
        quantityBefore: 0,
        quantityChange: stock,
        quantityAfter: stock,
        referenceType: 'manual_adjustment',
        referenceId: partRef.id,
        workOrderId: null,
        workOrderNumber: null,
        partsRequestId: null,
        performedBy: user.id,
        performedByName: user.name,
        performedByRole: user.role,
        performedAt: serverTimestamp(),
        notes: 'Initial stock — added as a machine spare part',
        unitCostAtTime: unitCost,
        totalCostImpact: stock * unitCost,
      });
    }
    await b.commit();
  }
}
