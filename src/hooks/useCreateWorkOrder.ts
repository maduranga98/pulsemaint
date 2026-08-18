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
import { notifyUsers } from '../services/notifications.service';
import { createWorkPermit } from '../services/safety.service';
import { markMachineUnderMaintenance } from '../lib/machineOperationalStatus';
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
    const companyId = userProfile.companyId;
    const userId = userProfile.id;
    const userName = userProfile.fullName ?? '';

    setLoading(true);
    setError(null);
    setUploadProgress([]);

    try {
      // Technicians can only act on WOs in ASSIGNED state, so a WO created
      // with technicians already attached must start as ASSIGNED, not OPEN.
      const initialStatus =
        (payload.assignedTechnicianIds?.length ?? 0) > 0 ? ('ASSIGNED' as const) : ('OPEN' as const);

      // Create WO document first to get the ID for Storage paths
      const woData = {
        // Tenant
        companyId,

        // Basic
        woType: payload.woType,
        pmType: payload.woType === 'PREVENTIVE' ? (payload.pmType ?? 'other') : null,
        priority: payload.priority,
        status: initialStatus,
        description: payload.description,
        specialToolsRequired: payload.specialToolsRequired ?? '',
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
        linkedBreakdownIds: payload.linkedBreakdownIds ?? [],
        followUpOfWoId: payload.followUpOfWoId ?? null,
        followUpOfWoNumber: payload.followUpOfWoNumber ?? null,
        followUpWoId: null,
        followUpWoNumber: null,

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
        contractorTechnicianIds: payload.contractorTechnicianIds ?? [],
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
        supervisorSignOffByName: null,
        supervisorSignOffAt: null,
        supervisorSignOffNotes: null,
        signOffOutcome: null,
        signOffOutcomeReason: null,

        // Status history
        statusHistory: [{
          status: initialStatus,
          changedBy: userId,
          changedByName: userName,
          changedAt: new Date(),
          note: initialStatus === 'ASSIGNED' ? 'Technicians assigned at creation' : null,
        }],

        // Metadata
        siteId,
        createdBy: userId,
        createdByName: userName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        closedAt: null,
        closedBy: null,
        closedByName: null,
        cancelledAt: null,
        cancelReason: null,
      };

      const docRef = await addDoc(collection(db, 'workOrders'), woData);
      const woId = docRef.id;

      // A new work order means active maintenance work is starting on the
      // machine — reflect that immediately.
      void markMachineUnderMaintenance(payload.machineId);

      // If this WO is a follow-up raised from another WO's sign-off, copy
      // over the origin's already-uploaded attachments (they have real
      // storage URLs already, so no re-upload is needed) and back-link the
      // origin WO so it shows the follow-up it spawned.
      if (payload.followUpOfWoId) {
        try {
          const { doc: docFn, updateDoc: updateDocFn, arrayUnion: arrayUnionFn } = await import('firebase/firestore');
          if (payload.copyExistingDocuments && payload.copyExistingDocuments.length > 0) {
            await updateDocFn(docRef, {
              documents: arrayUnionFn(...payload.copyExistingDocuments),
            });
          }
          await updateDocFn(docFn(db, 'workOrders', payload.followUpOfWoId), {
            followUpWoId: woId,
            updatedAt: serverTimestamp(),
          });
        } catch (linkErr) {
          console.error('Failed to link follow-up work order', linkErr);
        }
      }

      // Safety Work Permit raised alongside the WO. It lands in the same
      // `work_permits` collection the Safety Officer's Work Permits tab reads,
      // and flags the WO so it can't be started until the permit is active.
      if (payload.workPermit) {
        try {
          const wp = payload.workPermit;
          const permitId = await createWorkPermit({
            companyId,
            siteId,
            category: wp.category,
            title: wp.title.trim() || (payload.description?.slice(0, 60) ?? 'Work permit'),
            description: payload.description ?? '',
            location: payload.machineName ?? payload.machineLocation ?? '',
            machineId: payload.machineId ?? null,
            status: 'active',
            validFrom: wp.validFrom,
            validTo: wp.validTo,
            hazards: wp.hazards.trim(),
            precautions: wp.precautions,
            ppeRequired: wp.ppeRequired.trim(),
            workOrderId: woId,
            workOrderNumber: null,
            woType: payload.woType,
            woDescription: payload.description ?? '',
            woCreatedBy: userId,
            woCreatedByName: userName,
            supervisorId: payload.supervisorInChargeId || null,
            supervisorName: payload.supervisorInChargeName || null,
            requestedBy: userId,
            requestedByName: userName,
            requestedByRole: userProfile.role ?? '',
          });
          const { updateDoc } = await import('firebase/firestore');
          await updateDoc(docRef, { requiresWorkPermit: true, workPermitId: permitId });
        } catch (wpErr) {
          console.error('Failed to create linked work permit', wpErr);
        }
      }

      if ((payload.assignedTechnicianIds?.length ?? 0) > 0) {
        void notifyUsers(companyId, payload.assignedTechnicianIds!, {
          type: 'work_order',
          message: `You've been assigned to a new work order: ${payload.description?.slice(0, 60) || woId}`,
          oversightMessage: `created work order ${payload.description?.slice(0, 60) || woId} and assigned it`,
          actorName: userName,
          actorRole: userProfile.role,
          actorUserId: userProfile.id,
          severity: payload.priority === 'critical' || payload.priority === 'high' ? 'high' : 'medium',
          linkTo: '/app/work-orders',
        });
      }

      // Link back to every breakdown ticket this WO covers so the Breakdowns
      // tab shows a WO has been raised — one WO can cover several tickets on
      // the same machine (linkedBreakdownIds), not just the single primary
      // linkedBreakdownId. Status stays "assigned" (not yet "in progress")
      // until a technician actually starts the WO (see useMyWOState) — a
      // ticket shouldn't show repair progress before anyone has begun work.
      const ticketIdsToSync = Array.from(
        new Set([...(payload.linkedBreakdownId ? [payload.linkedBreakdownId] : []), ...(payload.linkedBreakdownIds ?? [])]),
      );
      if (ticketIdsToSync.length > 0) {
        try {
          const { doc: docFn, writeBatch, arrayUnion, Timestamp } = await import('firebase/firestore');
          const batch = writeBatch(db);
          for (const ticketId of ticketIdsToSync) {
            batch.update(docFn(db, 'breakdown_tickets', ticketId), {
              linkedWOId: woId,
              status: 'assigned',
              assignedTechnicianIds: payload.assignedTechnicianIds ?? [],
              assignedTechnicianNames: payload.assignedTechnicianNames ?? [],
              assignedAt: serverTimestamp(),
              statusHistory: arrayUnion({
                status: 'assigned',
                changedBy: userId,
                changedByName: userName,
                changedAt: Timestamp.fromDate(new Date()),
                note: `Repair work order created`,
              }),
            });
          }
          await batch.commit();
        } catch (bdErr) {
          console.error('Failed to sync linked breakdown(s) on WO creation', bdErr);
        }
      }

      // PM tracking: if this is a Preventive WO, write pm_history + pm_schedules
      // so it appears in PM Schedules tab, PM Calendar, and PM Compliance views.
      if (payload.woType === 'PREVENTIVE') {
        try {
          const { Timestamp } = await import('firebase/firestore');
          const due = payload.dueDate instanceof Date ? payload.dueDate : new Date();
          const month = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;
          const pmHistoryRef = await addDoc(collection(db, 'pm_history'), {
            companyId,
            scheduleId: null,
            scheduleName: payload.description.slice(0, 80) || 'Ad-hoc PM',
            machineId: payload.machineId,
            machineName: payload.machineName,
            woId,
            woNumber: '',
            dueDate: Timestamp.fromDate(due),
            completedDate: null,
            status: 'in_progress',
            daysOverdue: 0,
            technicianIds: payload.assignedTechnicianIds,
            technicianNames: payload.assignedTechnicianNames,
            duration: null,
            month,
            year: due.getFullYear(),
            createdAt: serverTimestamp(),
          });

          // Create a pm_schedules record so it shows in PM Schedules and Calendar tabs.
          const pmScheduleRef = await addDoc(collection(db, 'pm_schedules'), {
            companyId,
            name: payload.description.slice(0, 80) || 'Ad-hoc PM',
            pmType: payload.pmType ?? 'other',
            priority: payload.priority,
            machineId: payload.machineId,
            machineName: payload.machineName,
            triggerType: 'calendar',
            recurrenceType: 'one_time',
            intervalDays: 0,
            firstDueDate: Timestamp.fromDate(due),
            nextDueDate: Timestamp.fromDate(due),
            endDate: null,
            assignedTechnicianIds: payload.assignedTechnicianIds,
            assignedTechnicianNames: payload.assignedTechnicianNames,
            supervisorInChargeId: payload.supervisorInChargeId ?? null,
            supervisorInChargeName: payload.supervisorInChargeName ?? null,
            contractorCompanyName: payload.contractorCompanyName ?? null,
            contractorTechnicianNames: payload.contractorTechnicianNames ?? [],
            checklistItems: payload.checklist.map((item, i) => ({
              step: i + 1,
              description: item.stepDescription,
              type: 'check',
              required: true,
            })),
            status: 'active',
            totalScheduled: 1,
            completedOnTime: 0,
            completedLate: 0,
            missed: 0,
            complianceRate: 100,
            lastWoId: woId,
            lastWoGeneratedAt: Timestamp.now(),
            linkedWoId: woId,
            createdBy: userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Back-reference for completion updates.
          const { updateDoc } = await import('firebase/firestore');
          await updateDoc(docRef, {
            pmHistoryId: pmHistoryRef.id,
            pmScheduleId: pmScheduleRef.id,
          });
        } catch (pmErr) {
          console.error('Failed to create PM records', pmErr);
        }
      }

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
