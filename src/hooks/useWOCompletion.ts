import { useState, useCallback } from 'react';
import {
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { WOCompletionPayload } from '../types/workOrder';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface UploadProgress {
  fileName: string;
  progress: number;
}

interface UseWOCompletionResult {
  submitCompletion: (woId: string, siteId: string, payload: WOCompletionPayload) => Promise<boolean>;
  loading: boolean;
  progress: UploadProgress[];
  error: string | null;
}

async function uploadCompletionFile(
  file: File,
  siteId: string,
  woId: string,
  folder: string,
  onProgress: (p: number) => void,
): Promise<string> {
  const storagePath = `workorders/${siteId}/${woId}/${folder}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });
}

export function useWOCompletion(): UseWOCompletionResult {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const submitCompletion = useCallback(
    async (woId: string, siteId: string, payload: WOCompletionPayload): Promise<boolean> => {
      if (!user) return false;
      setLoading(true);
      setError(null);

      const progressMap: Record<string, number> = {};
      const allFiles = [
        ...payload.finalPhotos.map((f) => ({ file: f, folder: 'completion/photos' })),
        ...payload.updatedCADFiles.map((f) => ({ file: f, folder: 'completion/cad' })),
        ...payload.warrantyDocuments.map((f) => ({ file: f, folder: 'completion/warranty' })),
      ];
      setProgress(allFiles.map((f) => ({ fileName: f.file.name, progress: 0 })));

      try {
        // Upload all files in parallel
        const uploadResults = await Promise.all(
          allFiles.map(({ file, folder }) =>
            uploadCompletionFile(file, siteId, woId, folder, (p) => {
              progressMap[file.name] = p;
              setProgress(allFiles.map((f) => ({ fileName: f.file.name, progress: progressMap[f.file.name] ?? 0 })));
            }),
          ),
        );

        const photoCount = payload.finalPhotos.length;
        const cadCount = payload.updatedCADFiles.length;

        const finalPhotoUrls = uploadResults.slice(0, photoCount);
        const cadUrls = uploadResults.slice(photoCount, photoCount + cadCount);
        const warrantyUrls = uploadResults.slice(photoCount + cadCount);

        const durationMinutes = Math.round(
          (payload.actualEndTime.getTime() - payload.actualStartTime.getTime()) / 60000,
        );

        const historyEntry = {
          status: 'COMPLETED',
          changedBy: user.uid,
          changedByName: user.displayName ?? '',
          changedAt: serverTimestamp(),
          note: null,
        };

        const completionDocs = [
          ...cadUrls.map((url, i) => ({
            id: `${Date.now()}_cad_${i}`,
            name: payload.updatedCADFiles[i].name,
            fileType: 'cad' as const,
            format: payload.updatedCADFiles[i].name.split('.').pop()?.toUpperCase() ?? '',
            url,
            storagePath: url,
            fileSize: payload.updatedCADFiles[i].size,
            uploadedBy: user.uid,
            uploadedByName: user.displayName ?? '',
            uploadedAt: serverTimestamp(),
            isCompletionDocument: true,
          })),
          ...warrantyUrls.map((url, i) => ({
            id: `${Date.now()}_warranty_${i}`,
            name: payload.warrantyDocuments[i].name,
            fileType: 'document' as const,
            format: payload.warrantyDocuments[i].name.split('.').pop()?.toUpperCase() ?? '',
            url,
            storagePath: url,
            fileSize: payload.warrantyDocuments[i].size,
            uploadedBy: user.uid,
            uploadedByName: user.displayName ?? '',
            uploadedAt: serverTimestamp(),
            isCompletionDocument: true,
          })),
        ];

        await updateDoc(doc(db, 'workOrders', woId), {
          status: 'COMPLETED',
          statusHistory: arrayUnion(historyEntry),
          actualStartTime: payload.actualStartTime,
          actualEndTime: payload.actualEndTime,
          totalDurationMinutes: durationMinutes,
          workDoneDescription: payload.workDoneDescription,
          rootCause: payload.rootCause,
          rootCauseDescription: payload.rootCauseDescription,
          partsUsed: payload.partsUsed,
          technicianWorkLogs: payload.technicianWorkLogs,
          contractorHoursLog: payload.contractorHoursLog,
          postRepairChecklist: payload.postRepairChecklist,
          testRunResult: payload.testRunResult,
          testRunNotes: payload.testRunNotes,
          finalPhotos: finalPhotoUrls,
          machineStatusAfterRepair: payload.machineStatusAfterRepair,
          documents: completionDocs.length > 0 ? arrayUnion(...completionDocs) : [],
          updatedAt: serverTimestamp(),
        });

        toast.success('Completion submitted. Supervisor notified for sign-off.');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Completion submission failed';
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setLoading(false);
        setProgress([]);
      }
    },
    [user],
  );

  return { submitCompletion, loading, progress, error };
}
