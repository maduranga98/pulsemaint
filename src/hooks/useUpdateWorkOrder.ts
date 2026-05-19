import { useState, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
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
