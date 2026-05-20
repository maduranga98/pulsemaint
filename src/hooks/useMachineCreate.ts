import { useState } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
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

      // Upload photos
      const photoUrls: string[] = [];
      for (const photoFile of payload.photoFiles || []) {
        const photoRef = ref(
          storage,
          `companies/${payload.siteId}/machines/{newId}/photos/${photoFile.name}`
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
          `companies/${payload.siteId}/machines/{newId}/documents/${docPayload.file.name}`
        );
        await uploadBytes(docRef, docPayload.file);
        const docUrl = await getDownloadURL(docRef);
        documents.push({
          name: docPayload.name,
          type: docPayload.type,
          url: docUrl,
          uploadedAt: serverTimestamp(),
          uploadedBy: userId,
          size: docPayload.file.size,
        });
      }

      // Create machine document
      const machineData = {
        siteId: payload.siteId,
        name: payload.name,
        type: payload.type,
        manufacturer: payload.manufacturer,
        model: payload.model || null,
        serialNumber: payload.serialNumber || null,
        purchaseDate: payload.purchaseDate ? Timestamp.fromDate(payload.purchaseDate) : null,
        installationDate: payload.installationDate
          ? Timestamp.fromDate(payload.installationDate)
          : null,
        expectedLifespanYears: payload.expectedLifespanYears || null,
        department: payload.department,
        floor: payload.floor || null,
        bay: payload.bay || null,
        station: payload.station || null,
        status: 'active' as const,
        criticality: 3 as const,
        healthScore: 100,
        lastServiceDate: null,
        lastServiceType: null,
        lastTechnicians: [],
        nextPmDue: null,
        partsReplaced: [],
        compatiblePartIds: payload.compatiblePartIds || [],
        documents,
        photos: photoUrls,
        warrantyItems: [],
        modificationNotes: payload.modificationNotes || null,
        sopLibraryRefs: [],
        qrCode: null,
        oeeData: null,
        iotSensorId: null,
        createdAt: serverTimestamp(),
        createdBy: userId,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      };

      const docRef = await addDoc(collection(db, 'machines'), machineData);

      // TODO: Generate and upload QR code

      const newMachine: Machine = {
        id: docRef.id,
        ...machineData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as Machine;

      setCreating(false);
      onSuccess?.(newMachine);
      return newMachine;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create machine';
      setError(errorMsg);
      onError?.(err instanceof Error ? err : new Error(errorMsg));
      throw err;
    }
  };

  return {
    creating,
    error,
    createMachine,
  };
}
