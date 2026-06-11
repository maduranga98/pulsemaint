import { useState } from 'react';
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import { generateMachineQrUrl } from '../lib/machineQr';
import type { Machine, CreateMachinePayload } from '../types/machine';

interface UseMachineCreateOptions {
  onSuccess?: (machine: Machine) => void;
  onError?: (error: Error) => void;
}

interface UseMachineCreateResult {
  creating: boolean;
  error: string | null;
  createMachine: (payload: CreateMachinePayload) => Promise<Machine>;
}

export function useMachineCreate({
  onSuccess,
  onError,
}: UseMachineCreateOptions = {}): UseMachineCreateResult {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMachine = async (payload: CreateMachinePayload): Promise<Machine> => {
    try {
      setCreating(true);
      setError(null);
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      // Reserve the machine document ID up front so Storage paths and the QR
      // code can reference it before the document is written.
      const machineRef = doc(collection(db, 'machines'));
      const newId = machineRef.id;

      // Upload photos
      const photoUrls: string[] = [];
      for (const photoFile of payload.photoFiles || []) {
        const photoRef = ref(
          storage,
          `companies/${payload.siteId}/machines/${newId}/photos/${photoFile.name}`
        );
        await uploadBytes(photoRef, photoFile);
        const photoUrl = await getDownloadURL(photoRef);
        photoUrls.push(photoUrl);
      }

      // Upload documents
      const documents = [];
      for (const docPayload of payload.documentFiles || []) {
        const docRef = ref(
          storage,
          `companies/${payload.siteId}/machines/${newId}/documents/${docPayload.file.name}`
        );
        await uploadBytes(docRef, docPayload.file);
        const docUrl = await getDownloadURL(docRef);
        documents.push({
          name: docPayload.name,
          type: docPayload.type,
          url: docUrl,
          uploadedAt: Timestamp.now(),
          uploadedBy: userId,
          size: docPayload.file.size,
        });
      }

      // Create machine document
      const machineData = {
        siteId: payload.siteId,
        name: payload.name,
        nameLower: (payload.name ?? '').toLowerCase(),
        type: payload.type,
        manufacturer: payload.manufacturer,
        model: payload.model || null,
        serialNumber: payload.serialNumber || null,
        purchaseDate: payload.purchaseDate ? Timestamp.fromDate(payload.purchaseDate) : null,
        installationDate: payload.installationDate
          ? Timestamp.fromDate(payload.installationDate)
          : null,
        expectedLifespanYears: payload.expectedLifespanYears || null,
        purchasePrice: payload.purchasePrice ?? null,
        replacementValue: payload.replacementValue ?? null,
        department: payload.department,
        floor: payload.floor || null,
        bay: payload.bay || null,
        station: payload.station || null,
        status: payload.status,
        criticality: payload.criticality,
        healthScore: payload.healthScore ?? 100,
        lastServiceDate: null,
        lastServiceType: null,
        lastTechnicians: [],
        nextPmDue: payload.nextPmDue ? Timestamp.fromDate(payload.nextPmDue) : null,
        partsReplaced: [],
        compatiblePartIds: payload.compatiblePartIds || [],
        documents,
        photos: photoUrls,
        warrantyItems: (payload.warrantyItems ?? []).map((w: any) => ({
          partName: w.partName,
          expiryDate: w.expiryDate ? Timestamp.fromDate(w.expiryDate) : null,
          supplierWarrantyRef: w.supplierWarrantyRef ?? '',
        })),
        modificationNotes: payload.modificationNotes || null,
        additionalNotes: payload.additionalNotes || null,
        sopLibraryRefs: [],
        qrCode: generateMachineQrUrl(newId, payload.siteId),
        oeeData: null,
        iotSensorId: null,
        createdAt: serverTimestamp(),
        createdBy: userId,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      };

      await setDoc(machineRef, machineData);

      const newMachine: Machine = {
        id: newId,
        ...machineData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as Machine;

      onSuccess?.(newMachine);
      return newMachine;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create machine';
      setError(errorMsg);
      onError?.(err instanceof Error ? err : new Error(errorMsg));
      throw err;
    } finally {
      setCreating(false);
    }
  };

  return {
    creating,
    error,
    createMachine,
  };
}
