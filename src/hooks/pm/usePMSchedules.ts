import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { PMSchedule, CreatePMPayload, UpdatePMPayload, PMFilters } from '../../types/pm.types';

const COLLECTION = 'pm_schedules';

interface UsePMSchedulesOptions {
  companyId: string;
  filters?: PMFilters;
}

export function usePMSchedules({ companyId, filters = {} }: UsePMSchedulesOptions) {
  const [schedules, setSchedules] = useState<PMSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setError('Company ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);

    const constraints = [where('companyId', '==', companyId), orderBy('nextDueDate', 'asc')];

    const q = query(collection(db, COLLECTION), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PMSchedule[];

        // Apply client-side filters
        let filtered = fetched;

        if (filters.machineId) {
          filtered = filtered.filter((s) => s.machineId === filters.machineId);
        }
        if (filters.pmType && filters.pmType.length > 0) {
          filtered = filtered.filter((s) => filters.pmType!.includes(s.pmType));
        }
        if (filters.technicianId) {
          filtered = filtered.filter((s) => s.assignedTechnicianIds.includes(filters.technicianId!));
        }
        if (filters.status && filters.status.length > 0) {
          filtered = filtered.filter((s) => filters.status!.includes(s.status));
        }
        if (filters.priority && filters.priority.length > 0) {
          filtered = filtered.filter((s) => filters.priority!.includes(s.priority));
        }
        if (filters.dateFrom) {
          filtered = filtered.filter((s) => {
            const due = s.nextDueDate instanceof Date ? s.nextDueDate : s.nextDueDate.toDate();
            return due >= filters.dateFrom!;
          });
        }
        if (filters.dateTo) {
          filtered = filtered.filter((s) => {
            const due = s.nextDueDate instanceof Date ? s.nextDueDate : s.nextDueDate.toDate();
            return due <= filters.dateTo!;
          });
        }
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          filtered = filtered.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.machineName.toLowerCase().includes(q) ||
              s.assignedTechnicianNames.some((n) => n.toLowerCase().includes(q)),
          );
        }

        setSchedules(filtered);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching PM schedules:', err);
        setError(err.message || 'Failed to fetch PM schedules');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId, filters]);

  const createSchedule = useCallback(
    async (payload: CreatePMPayload, userId: string): Promise<string> => {
      const nextDue = payload.triggerType === 'calendar'
        ? payload.firstDueDate
        : new Date(); // Usage-based starts immediately or when meter is reached

      const docRef = await addDoc(collection(db, COLLECTION), {
        ...payload,
        companyId,
        nextDueDate: Timestamp.fromDate(nextDue),
        firstDueDate: payload.firstDueDate ? Timestamp.fromDate(payload.firstDueDate) : null,
        endDate: payload.endDate ? Timestamp.fromDate(payload.endDate) : null,
        peakSeasonStart: payload.peakSeasonStart ? Timestamp.fromDate(payload.peakSeasonStart) : null,
        peakSeasonEnd: payload.peakSeasonEnd ? Timestamp.fromDate(payload.peakSeasonEnd) : null,
        lastMeterResetDate: payload.lastMeterResetDate ? Timestamp.fromDate(payload.lastMeterResetDate) : null,
        status: 'active',
        totalScheduled: 0,
        completedOnTime: 0,
        completedLate: 0,
        missed: 0,
        complianceRate: 100,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastWoGeneratedAt: null,
        lastWoId: null,
        checklistItems: payload.checklistItems.map((item, index) => ({
          ...item,
          id: `step-${index + 1}-${Date.now()}`,
          step: index + 1,
        })),
      });

      return docRef.id;
    },
    [companyId],
  );

  const updateSchedule = useCallback(
    async (payload: UpdatePMPayload): Promise<void> => {
      const { scheduleId, companyId: _, documents, ...rest } = payload;
      const ref = doc(db, COLLECTION, scheduleId);

      const updateData: Record<string, unknown> = {
        ...rest,
        updatedAt: serverTimestamp(),
      };

      if (rest.firstDueDate) updateData.firstDueDate = Timestamp.fromDate(rest.firstDueDate);
      if (rest.endDate !== undefined) updateData.endDate = rest.endDate ? Timestamp.fromDate(rest.endDate) : null;
      if (rest.peakSeasonStart !== undefined) updateData.peakSeasonStart = rest.peakSeasonStart ? Timestamp.fromDate(rest.peakSeasonStart) : null;
      if (rest.peakSeasonEnd !== undefined) updateData.peakSeasonEnd = rest.peakSeasonEnd ? Timestamp.fromDate(rest.peakSeasonEnd) : null;
      if (rest.lastMeterResetDate !== undefined) updateData.lastMeterResetDate = rest.lastMeterResetDate ? Timestamp.fromDate(rest.lastMeterResetDate) : null;

      // Remove undefined fields
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === undefined) delete updateData[key];
      });

      await updateDoc(ref, updateData);
    },
    [],
  );

  const pauseSchedule = useCallback(async (scheduleId: string): Promise<void> => {
    const ref = doc(db, COLLECTION, scheduleId);
    await updateDoc(ref, { status: 'paused', updatedAt: serverTimestamp() });
  }, []);

  const activateSchedule = useCallback(async (scheduleId: string): Promise<void> => {
    const ref = doc(db, COLLECTION, scheduleId);
    await updateDoc(ref, { status: 'active', updatedAt: serverTimestamp() });
  }, []);

  const archiveSchedule = useCallback(async (scheduleId: string): Promise<void> => {
    const ref = doc(db, COLLECTION, scheduleId);
    await updateDoc(ref, { status: 'archived', updatedAt: serverTimestamp() });
  }, []);

  const deleteSchedule = useCallback(async (scheduleId: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTION, scheduleId));
  }, []);

  const bulkUpdateStatus = useCallback(
    async (scheduleIds: string[], status: PMSchedule['status']): Promise<void> => {
      const batch = writeBatch(db);
      scheduleIds.forEach((id) => {
        batch.update(doc(db, COLLECTION, id), { status, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    },
    [],
  );

  const bulkDelete = useCallback(async (scheduleIds: string[]): Promise<void> => {
    const batch = writeBatch(db);
    scheduleIds.forEach((id) => {
      batch.delete(doc(db, COLLECTION, id));
    });
    await batch.commit();
  }, []);

  const updateMeterValue = useCallback(
    async (scheduleId: string, value: number, resetDate: Date | null): Promise<void> => {
      const ref = doc(db, COLLECTION, scheduleId);
      await updateDoc(ref, {
        currentMeterValue: value,
        lastMeterUpdateDate: serverTimestamp(),
        lastMeterResetDate: resetDate ? Timestamp.fromDate(resetDate) : null,
        updatedAt: serverTimestamp(),
      });
    },
    [],
  );

  const triggerManualPM = useCallback(
    async (scheduleId: string): Promise<void> => {
      // This will be handled by a Cloud Function call
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const triggerManualPMFn = httpsCallable(functions, 'triggerManualPM');
      await triggerManualPMFn({ scheduleId });
    },
    [],
  );

  return {
    schedules,
    loading,
    error,
    createSchedule,
    updateSchedule,
    pauseSchedule,
    activateSchedule,
    archiveSchedule,
    deleteSchedule,
    bulkUpdateStatus,
    bulkDelete,
    updateMeterValue,
    triggerManualPM,
  };
}
