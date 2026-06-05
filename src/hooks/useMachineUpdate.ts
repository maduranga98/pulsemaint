import { useState } from 'react';
import {
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import type { Machine, UpdateMachinePayload } from '../types/machine';

interface UseMachineUpdateOptions {
  onSuccess?: (machine: Machine) => void;
  onError?: (error: Error) => void;
}

interface UseMachineUpdateResult {
  updating: boolean;
  error: string | null;
  updateMachine: (payload: UpdateMachinePayload) => Promise<void>;
}

export function useMachineUpdate({
  onSuccess: _onSuccess,
  onError,
}: UseMachineUpdateOptions = {}): UseMachineUpdateResult {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMachine = async (payload: UpdateMachinePayload): Promise<void> => {
    try {
      setUpdating(true);
      setError(null);
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      // Upload new photos if provided
      let photoUrls: string[] | undefined;
      if (payload.photoFiles && payload.photoFiles.length > 0) {
        photoUrls = [];
        for (const photoFile of payload.photoFiles) {
          const photoRef = ref(
            storage,
            `companies/${payload.siteId}/machines/${payload.machineId}/photos/${photoFile.name}`
          );
          await uploadBytes(photoRef, photoFile);
          const photoUrl = await getDownloadURL(photoRef);
          photoUrls.push(photoUrl);
        }
      }

      // Upload new documents if provided
      let documents;
      if (payload.documentFiles && payload.documentFiles.length > 0) {
        documents = [];
        for (const docPayload of payload.documentFiles) {
          const docRef = ref(
            storage,
            `companies/${payload.siteId}/machines/${payload.machineId}/documents/${docPayload.file.name}`
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
      }

      // Build update object
      const updateData: Record<string, any> = {
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      };

      if (payload.name) updateData.name = payload.name;
      if (payload.type) updateData.type = payload.type;
      if (payload.manufacturer) updateData.manufacturer = payload.manufacturer;
      if (payload.model !== undefined) updateData.model = payload.model;
      if (payload.serialNumber !== undefined) updateData.serialNumber = payload.serialNumber;
      if (payload.purchaseDate !== undefined) {
        updateData.purchaseDate = payload.purchaseDate ? Timestamp.fromDate(payload.purchaseDate) : null;
      }
      if (payload.installationDate !== undefined) {
        updateData.installationDate = payload.installationDate
          ? Timestamp.fromDate(payload.installationDate)
          : null;
      }
      if (payload.expectedLifespanYears !== undefined) {
        updateData.expectedLifespanYears = payload.expectedLifespanYears;
      }
      if (payload.department) updateData.department = payload.department;
      if (payload.floor !== undefined) updateData.floor = payload.floor;
      if (payload.bay !== undefined) updateData.bay = payload.bay;
      if (payload.station !== undefined) updateData.station = payload.station;
      if (payload.status) updateData.status = payload.status;
      if (payload.criticality) updateData.criticality = payload.criticality;
      if (photoUrls) updateData.photos = photoUrls;
      if (documents) updateData.documents = documents;
      if (payload.compatiblePartIds) updateData.compatiblePartIds = payload.compatiblePartIds;
      if (payload.modificationNotes !== undefined) updateData.modificationNotes = payload.modificationNotes;
      if (payload.additionalNotes !== undefined) updateData.additionalNotes = payload.additionalNotes;

      // Update Firestore document
      const machineRef = doc(db, 'machines', payload.machineId);
      await updateDoc(machineRef, updateData);

      setUpdating(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update machine';
      setError(errorMsg);
      onError?.(err instanceof Error ? err : new Error(errorMsg));
      throw err;
    }
  };

  return {
    updating,
    error,
    updateMachine,
  };
}
