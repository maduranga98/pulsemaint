import { useState, useCallback } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { BreakdownStatus } from '../types/breakdown';
import { db } from '../lib/firebase';
import type { WorkOrder, WOStatus } from '../types/workOrder';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface UseUpdateWorkOrderResult {
  updateWO: (id: string, data: Partial<WorkOrder>) => Promise<boolean>;
  updateStatus: (id: string, status: WOStatus, note?: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function useUpdateWorkOrder(): UseUpdateWorkOrderResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const updateWO = useCallback(async (id: string, data: Partial<WorkOrder>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'workOrders', id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = useCallback(
    async (id: string, status: WOStatus, note?: string): Promise<boolean> => {
      if (!user) return false;
      setLoading(true);
      setError(null);

      const historyEntry = {
        status,
        changedBy: user.uid,
        changedByName: user.displayName ?? '',
        changedAt: serverTimestamp(),
        note: note ?? null,
      };

      const updates: Record<string, unknown> = {
        status,
        statusHistory: arrayUnion(historyEntry),
        updatedAt: serverTimestamp(),
      };

      if (status === 'CANCELLED') {
        updates.cancelledAt = serverTimestamp();
        updates.cancelReason = note ?? null;
      }

      try {
        await updateDoc(doc(db, 'workOrders', id), updates);

        // Sync linked breakdown ticket progress.
        try {
          const snap = await getDoc(doc(db, 'workOrders', id));
          const data = snap.data() as any;
          if (data?.linkedBreakdownId) {
            const map: Partial<Record<WOStatus, BreakdownStatus>> = {
              OPEN: 'reported',
              ASSIGNED: 'assigned',
              IN_PROGRESS: 'repair_in_progress',
              ON_HOLD_PARTS: 'on_hold_parts',
              ON_HOLD_APPROVAL: 'on_hold_approval',
              COMPLETED: 'resolved',
              SIGNED_OFF: 'resolved',
              CLOSED: 'closed',
              CANCELLED: 'closed',
            };
            const bdStatus = map[status];
            if (bdStatus) {
              const bdUpdates: Record<string, unknown> = {
                status: bdStatus,
                statusHistory: arrayUnion({
                  status: bdStatus,
                  changedBy: user.uid,
                  changedByName: user.displayName ?? '',
                  changedAt: Timestamp.fromDate(new Date()),
                  note: `WO ${data.woNumber ?? id} status: ${status}`,
                }),
              };
              if (bdStatus === 'resolved') bdUpdates.resolvedAt = serverTimestamp();
              if (bdStatus === 'closed') bdUpdates.closedAt = serverTimestamp();
              await updateDoc(doc(db, 'breakdown_tickets', data.linkedBreakdownId), bdUpdates);
            }
          }
        } catch (bdErr) {
          console.error('Failed to sync breakdown progress', bdErr);
        }

        toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Status update failed';
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  return { updateWO, updateStatus, loading, error };
}
