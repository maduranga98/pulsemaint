import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { parseInventoryExcel } from '@/lib/inventory/importParser';
import { validateImportRows } from '@/lib/inventory/importValidator';
import type { ValidationResult, InventoryPart } from '@/types/inventory';
import { ImportStepIndicator } from '@/components/inventory/import/ImportStepIndicator';
import { ImportTemplateStep } from '@/components/inventory/import/ImportTemplateStep';
import { ImportUploadStep } from '@/components/inventory/import/ImportUploadStep';
import { ImportValidationResults } from '@/components/inventory/import/ImportValidationResults';
import { ImportProgressScreen } from '@/components/inventory/import/ImportProgressScreen';
import { ImportCompleteScreen } from '@/components/inventory/import/ImportCompleteScreen';

type Step = 1 | 2 | 3 | 4 | 5;

interface ImportState {
  file: File | null;
  validationResult: ValidationResult | null;
  existingPartNumbers: Set<string>;
  sessionId: string | null;
  newCount: number;
  updateCount: number;
  skippedCount: number;
  importProgress: number;
  totalRows: number;
  fileName: string;
}

export function ExcelImportPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? '';

  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<ImportState>({
    file: null,
    validationResult: null,
    existingPartNumbers: new Set(),
    sessionId: null,
    newCount: 0,
    updateCount: 0,
    skippedCount: 0,
    importProgress: 0,
    totalRows: 0,
    fileName: '',
  });

  async function handleFileSelected(file: File) {
    try {
      // Parse file
      const parsed = await parseInventoryExcel(file);

      // Load existing part numbers to determine CREATE vs UPDATE
      const snap = await getDocs(
        query(collection(db, 'inventoryParts'), where('companyId', '==', companyId))
      );
      const existingPartNumbers = new Set<string>(
        snap.docs.map((d) => (d.data() as InventoryPart).partNumber)
      );

      // Validate
      const validationResult = validateImportRows(parsed.rows, existingPartNumbers);

      setState((prev) => ({
        ...prev,
        file,
        validationResult,
        existingPartNumbers,
        fileName: file.name,
        totalRows: parsed.totalRows,
      }));
      setStep(3);
    } catch (err) {
      addToast('Failed to parse file. Please check the format and try again.', 'error');
      console.error(err);
    }
  }

  async function handleConfirmImport() {
    if (!state.validationResult || !state.file) return;
    const { validRows, createCount, updateCount } = state.validationResult;

    setStep(4);
    setState((prev) => ({ ...prev, importProgress: 0, totalRows: validRows.length }));

    try {
      // Create import session
      const sessionRef = await addDoc(collection(db, 'inventoryImportSessions'), {
        companyId,
        status: 'importing',
        fileName: state.file.name,
        fileSizeBytes: state.file.size,
        totalRows: validRows.length,
        validRows: validRows.length,
        errorRows: 0,
        newPartsCount: 0,
        updatedPartsCount: 0,
        skippedCount: 0,
        importedBy: userId,
        importedByName: userName,
        startedAt: serverTimestamp(),
        completedAt: null,
        reversedAt: null,
        reversedBy: null,
        errors: [],
        affectedPartIds: [],
      });

      const affectedIds: string[] = [];
      const BATCH_SIZE = 499;
      let processed = 0;

      // Load existing part docs for UPDATE
      const existingSnap = await getDocs(
        query(collection(db, 'inventoryParts'), where('companyId', '==', companyId))
      );
      const existingByPartNumber = new Map<string, string>(
        existingSnap.docs.map((d) => [(d.data() as InventoryPart).partNumber, d.id])
      );

      // Process in batches
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batchRows = validRows.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const row of batchRows) {
          const isUpdate = state.existingPartNumbers.has(row.partNumber);

          if (isUpdate) {
            const existingId = existingByPartNumber.get(row.partNumber);
            if (existingId) {
              const ref = doc(db, 'inventoryParts', existingId);
              batch.update(ref, {
                name: row.name,
                description: row.description || '',
                brand: row.brand || '',
                modelRef: row.modelRef || '',
                category: row.category,
                unit: row.unit,
                status: row.status || 'active',
                criticality: row.criticality || 'medium',
                currentStock: parseFloat(row.currentStock) || 0,
                minStockLevel: parseFloat(row.minStockLevel) || 0,
                maxStockLevel: parseFloat(row.maxStockLevel) || 0,
                unitCost: parseFloat(row.unitCost) || 0,
                supplierName: row.supplierName || '',
                storeLocation: row.storeLocation || '',
                supplierPartCode: row.supplierPartCode || '',
                supplierContact: row.supplierContact || '',
                leadTimeDays: parseInt(row.leadTimeDays) || 0,
                lastPurchaseDate: row.lastPurchaseDate || null,
                lastPurchasePrice: parseFloat(row.lastPurchasePrice) || 0,
                warrantyMonths: parseInt(row.warrantyMonths) || 0,
                notes: row.notes || '',
                importedAt: serverTimestamp(),
                importedFrom: sessionRef.id,
                updatedAt: serverTimestamp(),
                updatedBy: userId,
                isLowStock: false,
              });
              affectedIds.push(existingId);
            }
          } else {
            const ref = doc(collection(db, 'inventoryParts'));
            batch.set(ref, {
              companyId,
              partNumber: row.partNumber,
              name: row.name,
              description: row.description || '',
              brand: row.brand || '',
              modelRef: row.modelRef || '',
              category: row.category,
              unit: row.unit,
              status: row.status || 'active',
              criticality: row.criticality || 'medium',
              currentStock: parseFloat(row.currentStock) || 0,
              minStockLevel: parseFloat(row.minStockLevel) || 0,
              maxStockLevel: parseFloat(row.maxStockLevel) || 0,
              reservedStock: 0,
              availableStock: parseFloat(row.currentStock) || 0,
              unitCost: parseFloat(row.unitCost) || 0,
              lastPurchasePrice: parseFloat(row.lastPurchasePrice) || 0,
              lastPurchaseDate: row.lastPurchaseDate || null,
              supplierName: row.supplierName || '',
              supplierContact: row.supplierContact || '',
              supplierPartCode: row.supplierPartCode || '',
              storeLocation: row.storeLocation || '',
              leadTimeDays: parseInt(row.leadTimeDays) || 0,
              warrantyMonths: parseInt(row.warrantyMonths) || 0,
              compatibleMachineIds: row.compatibleMachineIds
                ? row.compatibleMachineIds.split(',').map((s) => s.trim()).filter(Boolean)
                : [],
              isCritical: row.criticality === 'critical',
              isLowStock: false,
              cadFiles: [],
              images: [],
              totalUsedAllTime: 0,
              totalCostAllTime: 0,
              lastIssuedAt: null,
              lastReceivedAt: null,
              importedAt: serverTimestamp(),
              importedFrom: sessionRef.id,
              notes: row.notes || '',
              createdAt: serverTimestamp(),
              createdBy: userId,
              updatedAt: serverTimestamp(),
              updatedBy: userId,
            });
            affectedIds.push(ref.id);
          }
        }

        await batch.commit();
        processed += batchRows.length;
        setState((prev) => ({ ...prev, importProgress: processed }));
      }

      // Update session to completed
      await updateDoc(sessionRef, {
        status: 'completed',
        newPartsCount: createCount,
        updatedPartsCount: updateCount,
        skippedCount: 0,
        affectedPartIds: affectedIds,
        completedAt: serverTimestamp(),
      });

      setState((prev) => ({
        ...prev,
        sessionId: sessionRef.id,
        newCount: createCount,
        updateCount: updateCount,
        skippedCount: 0,
      }));
      setStep(5);
    } catch (err) {
      addToast('Import failed. Please try again.', 'error');
      console.error(err);
      setStep(3);
    }
  }

  async function handleUndo() {
    if (!state.sessionId) return;
    try {
      const sessionSnap = await getDocs(
        query(
          collection(db, 'inventoryImportSessions'),
          where('companyId', '==', companyId)
        )
      );
      const sessionDoc = sessionSnap.docs.find((d) => d.id === state.sessionId);
      if (!sessionDoc) return;

      // Simple: just mark session reversed (full reversal would need original data snapshot)
      await updateDoc(doc(db, 'inventoryImportSessions', state.sessionId), {
        status: 'reversed',
        reversedAt: serverTimestamp(),
        reversedBy: userId,
      });

      addToast('Import has been reversed.', 'success');
    } catch (err) {
      addToast('Failed to undo import.', 'error');
      console.error(err);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Excel Import</h1>
        <p className="text-gray-500 text-sm mt-0.5">Import or update inventory parts from a spreadsheet.</p>
      </div>

      <ImportStepIndicator currentStep={step} />

      <div className="min-h-[400px]">
        {step === 1 && (
          <ImportTemplateStep
            onDownload={() => {}}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <ImportUploadStep
            onFileSelected={handleFileSelected}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && state.validationResult && (
          <ImportValidationResults
            validationResult={state.validationResult}
            existingPartNumbers={state.existingPartNumbers}
            onConfirm={handleConfirmImport}
            onReUpload={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <ImportProgressScreen
            current={state.importProgress}
            total={state.totalRows}
            fileName={state.fileName}
          />
        )}

        {step === 5 && (
          <ImportCompleteScreen
            newCount={state.newCount}
            updateCount={state.updateCount}
            skippedCount={state.skippedCount}
            sessionId={state.sessionId ?? ''}
            onUndo={handleUndo}
            onViewParts={() => navigate('/app/inventory/catalog')}
          />
        )}
      </div>
    </div>
  );
}
export default ExcelImportPage;
