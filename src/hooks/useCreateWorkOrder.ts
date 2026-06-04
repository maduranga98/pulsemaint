import { useState, useCallback } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { CreateWOPayload, WODocument } from '../types/workOrder';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface UploadProgress {
  fileName: string;
  progress: number;
}

interface UseCreateWorkOrderResult {
  createWO: (payload: CreateWOPayload) => Promise<string | null>;
  loading: boolean;
  uploadProgress: UploadProgress[];
  error: string | null;
}

function getFileType(file: File): WODocument['fileType'] {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl'].includes(ext)) return 'cad';
  if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) return 'image';
  if (['zip', 'rar'].includes(ext)) return 'compressed';
  return 'document';
}

async function uploadFile(
  file: File,
  siteId: string,
  woId: string,
  onProgress: (p: number) => void,
): Promise<WODocument> {
  const storagePath = `workorders/${siteId}/${woId}/documents/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snap) => {
        onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      reject,
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          id: `${Date.now()}_${file.name}`,
          name: file.name,
          fileType: getFileType(file),
          format: file.name.split('.').pop()?.toUpperCase() ?? '',
          url,
          storagePath,
          fileSize: file.size,
          uploadedBy: '',         // filled server-side via context
          uploadedByName: '',
          uploadedAt: null as never,
          isCompletionDocument: false,
        });
      },
    );
  });
}

export function useCreateWorkOrder(): UseCreateWorkOrderResult {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  const userProfile = useAuthStore((s) => s.userProfile);

  const createWO = useCallback(async (payload: CreateWOPayload): Promise<string | null> => {
    if (!userProfile) {
      toast.error('You must be logged in to create a work order');
      return null;
    }

    const siteId = userProfile.siteIds[0] ?? userProfile.companyId;
    const userId = userProfile.id;
    const userName = userProfile.fullName ?? '';

    setLoading(true);
    setError(null);
    setUploadProgress([]);

    try {
      // Create WO document first to get the ID for Storage paths
      const woData = {
        // Basic
        woType: payload.woType,
        priority: payload.priority,
        status: 'OPEN' as const,
        description: payload.description,
        dueDate: payload.dueDate,
        scheduledStart: payload.scheduledStart ?? null,
        estimatedDuration: payload.estimatedDuration,
        estimatedDurationUnit: payload.estimatedDurationUnit,
        slaBreached: false,
        slaDeadline: null,   // filled by Cloud Function
        woNumber: '',         // filled by Cloud Function

        // Links
        linkedBreakdownId: payload.linkedBreakdownId ?? null,
        linkedBreakdownTicketNumber: payload.linkedBreakdownTicketNumber ?? null,

        // Machine
        machineId: payload.machineId,
        machineName: payload.machineName,
        machineDepartment: payload.machineDepartment,
        machineLocation: payload.machineLocation,
        machineType: payload.machineType,
        machineCriticality: payload.machineCriticality,

        // Assignment
        supervisorInChargeId: payload.supervisorInChargeId,
        supervisorInChargeName: payload.supervisorInChargeName,
        assignedTechnicianIds: payload.assignedTechnicianIds,
        assignedTechnicianNames: payload.assignedTechnicianNames,

        // Contractor
        contractorCompanyId: payload.contractorCompanyId,
        contractorCompanyName: payload.contractorCompanyName,
        contractorContactPerson: payload.contractorContactPerson,
        contractorContactNumber: payload.contractorContactNumber,
        contractorTechnicianNames: payload.contractorTechnicianNames,
        isManualContractor: payload.isManualContractor,

        // Checklist (reset completion state)
        checklist: payload.checklist.map((item, i) => ({
          ...item,
          stepNumber: i + 1,
          isCompleted: false,
          completedBy: null,
          completedByName: null,
          completedAt: null,
        })),

        // Init empty arrays
        documents: [],
        partsRequests: payload.partsRequests.map((pr) => ({
          ...pr,
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          requestedBy: userId,
          requestedByName: userName,
          requestedAt: new Date(),
          status: 'pending',
          approvedBy: null,
          approvedAt: null,
          rejectedReason: null,
          issuedBy: null,
          issuedAt: null,
        })),

        // Completion (empty)
        actualStartTime: null,
        actualEndTime: null,
        totalDurationMinutes: null,
        workDoneDescription: null,
        rootCause: null,
        rootCauseDescription: null,
        partsUsed: [],
        technicianWorkLogs: [],
        contractorHoursLog: null,
        postRepairChecklist: [],
        testRunResult: null,
        testRunNotes: null,
        finalPhotos: [],
        machineStatusAfterRepair: null,

        // Sign-off
        supervisorSignOffSignature: null,
        supervisorSignOffBy: null,
        supervisorSignOffAt: null,
        supervisorSignOffNotes: null,

        // Status history
        statusHistory: [{
          status: 'OPEN',
          changedBy: userId,
          changedByName: userName,
          changedAt: new Date(),
          note: null,
        }],

        // Metadata
        siteId,
        createdBy: userId,
        createdByName: userName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        closedAt: null,
        cancelledAt: null,
        cancelReason: null,
      };

      const docRef = await addDoc(collection(db, 'workOrders'), woData);
      const woId = docRef.id;

      // Upload documents
      if (payload.documents.length > 0) {
        const progressMap: Record<string, number> = {};
        setUploadProgress(payload.documents.map((f) => ({ fileName: f.name, progress: 0 })));

        const uploadedDocs = await Promise.all(
          payload.documents.map((file) =>
            uploadFile(file, siteId, woId, (p) => {
              progressMap[file.name] = p;
              setUploadProgress(
                payload.documents.map((f) => ({ fileName: f.name, progress: progressMap[f.name] ?? 0 })),
              );
            }),
          ),
        );

        // Attach uploaded docs to WO. NOTE: serverTimestamp() is NOT allowed
        // inside array elements, so we use a client Timestamp instead.
        const { updateDoc, arrayUnion, Timestamp } = await import('firebase/firestore');
        const uploadedAt = Timestamp.now();
        await updateDoc(docRef, {
          documents: arrayUnion(...uploadedDocs.map((d) => ({
            ...d,
            uploadedBy: userId,
            uploadedByName: userName,
            uploadedAt,
          }))),
          updatedAt: serverTimestamp(),
        });
      }

      toast.success('Work order created successfully');
      return woId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create work order';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
      setUploadProgress([]);
    }
  }, [userProfile]);

  return { createWO, loading, uploadProgress, error };
}
