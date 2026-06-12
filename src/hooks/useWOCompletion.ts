import { useState, useCallback } from 'react';
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  arrayUnion,
  serverTimestamp,
  Timestamp,
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
            uploadedAt: Timestamp.now(),
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
            uploadedAt: Timestamp.now(),
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

        // PM tracking: if this WO has a linked pm_history record, mark it
        // completed_on_time / completed_late based on the due date.
        try {
          const woSnap = await getDoc(doc(db, 'workOrders', woId));
          const woData = woSnap.data() as any;
          if (woData?.woType === 'PREVENTIVE' && woData?.pmHistoryId) {
            const due: Date | null = woData.dueDate?.toDate?.() ?? null;
            const onTime = !due || payload.actualEndTime <= due;
            const daysOverdue = due
              ? Math.max(0, Math.ceil((payload.actualEndTime.getTime() - due.getTime()) / 86400000))
              : 0;
            await updateDoc(doc(db, 'pm_history', woData.pmHistoryId), {
              status: onTime ? 'completed_on_time' : 'completed_late',
              completedDate: Timestamp.fromDate(payload.actualEndTime),
              duration: durationMinutes,
              daysOverdue,
              technicianIds: woData.assignedTechnicianIds ?? [],
              technicianNames: woData.assignedTechnicianNames ?? [],
              woNumber: woData.woNumber ?? '',
            });
          }
        } catch (pmErr) {
          console.error('Failed to update PM history on completion', pmErr);
        }

        // Machine record updates: lastServiceDate, nextPMDate, and history entry.
        try {
          const woSnap = await getDoc(doc(db, 'workOrders', woId));
          const woData = woSnap.data() as any;
          if (woData?.machineId) {
            const machineRef = doc(db, 'machines', woData.machineId);
            const machineUpdates: Record<string, unknown> = {
              lastServiceDate: Timestamp.fromDate(payload.actualEndTime),
              lastServiceType: woData.woType ?? null,
              updatedAt: serverTimestamp(),
            };

            if (woData.woType === 'PREVENTIVE') {
              let intervalDays: number | null = null;
              if (woData.pmScheduleId) {
                try {
                  const pmSnap = await getDoc(doc(db, 'pm_schedules', woData.pmScheduleId));
                  const pm = pmSnap.data() as any;
                  if (pm) {
                    const recurrenceMap: Record<string, number> = {
                      daily: 1,
                      weekly: 7,
                      biweekly: 14,
                      monthly: 30,
                      quarterly: 90,
                      semi_annual: 182,
                      annual: 365,
                    };
                    intervalDays = pm.customIntervalDays ?? recurrenceMap[pm.recurrenceType] ?? null;
                  }
                } catch (e) {
                  console.error('Failed to fetch PM schedule for next due', e);
                }
              }
              if (intervalDays) {
                const next = new Date(payload.actualEndTime.getTime() + intervalDays * 86400000);
                machineUpdates.nextPmDue = Timestamp.fromDate(next);
              }
            }

            await updateDoc(machineRef, machineUpdates);

            const historyType =
              woData.woType === 'BREAKDOWN'
                ? 'breakdown'
                : woData.woType === 'PREVENTIVE'
                  ? 'pm'
                  : 'maintenance';
            const totalPartsCost = (payload.partsUsed ?? []).reduce(
              (sum, p) => sum + (p.totalCost ?? 0),
              0,
            );
            await addDoc(collection(db, 'machineHistory', woData.machineId, 'entries'), {
              type: historyType,
              date: Timestamp.fromDate(payload.actualEndTime),
              woId,
              woNumber: woData.woNumber ?? '',
              woType: woData.woType ?? null,
              priority: woData.priority ?? 'medium',
              actualStartTime: payload.actualStartTime ? Timestamp.fromDate(payload.actualStartTime) : null,
              actualEndTime: Timestamp.fromDate(payload.actualEndTime),
              totalDurationMinutes: durationMinutes,
              durationMinutes,
              description: payload.workDoneDescription ?? woData.description ?? '',
              workDoneDescription: payload.workDoneDescription ?? woData.description ?? '',
              rootCause: payload.rootCause ?? null,
              internalTeamNames: woData.assignedTechnicianNames ?? [],
              technicianIds: woData.assignedTechnicianIds ?? [],
              technicianNames: woData.assignedTechnicianNames ?? [],
              contractorName: woData.contractorCompanyName ?? null,
              contractorTechnicianNames: woData.contractorTechnicianNames ?? [],
              partsUsed: payload.partsUsed ?? [],
              totalPartsCost,
              testRunResult: payload.testRunResult ?? null,
              finalPhotoUrls,
              supervisorSignOffBy: woData.supervisorInChargeName ?? '',
              supervisorSignOffAt: null,
              linkedBreakdownId: woData.linkedBreakdownId ?? null,
              createdAt: serverTimestamp(),
            });
          }
        } catch (machineErr) {
          console.error('Failed to update machine record on completion', machineErr);
        }

        // Sync linked breakdown progress.
        try {
          const woSnap = await getDoc(doc(db, 'workOrders', woId));
          const woData = woSnap.data() as any;
          if (woData?.linkedBreakdownId) {
            await updateDoc(doc(db, 'breakdown_tickets', woData.linkedBreakdownId), {
              status: 'resolved',
              resolvedAt: Timestamp.fromDate(payload.actualEndTime),
              statusHistory: arrayUnion({
                status: 'resolved',
                changedBy: user.uid,
                changedByName: user.displayName ?? '',
                changedAt: Timestamp.fromDate(new Date()),
                note: `WO ${woData.woNumber ?? woId} completed`,
              }),
            });
          }
        } catch (bdErr) {
          console.error('Failed to sync linked breakdown on completion', bdErr);
        }

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
