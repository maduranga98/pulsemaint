import { useState, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { WOSignOffPayload } from '../types/workOrder';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

interface UseSignOffResult {
  signOff: (woId: string, siteId: string, payload: WOSignOffPayload) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function useSignOff(): UseSignOffResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const signOff = useCallback(
    async (woId: string, siteId: string, payload: WOSignOffPayload): Promise<boolean> => {
      if (!user) return false;
      setLoading(true);
      setError(null);

      try {
        // Upload signature PNG to Firebase Storage
        const sigPath = `workorders/${siteId}/${woId}/signatures/${user.uid}_${Date.now()}.png`;
        const sigRef = ref(storage, sigPath);

        // payload.signature is a base64 data URL
        await uploadString(sigRef, payload.signature, 'data_url');
        const sigUrl = await getDownloadURL(sigRef);

        const historyEntry = {
          status: 'SIGNED_OFF',
          changedBy: user.uid,
          changedByName: user.displayName ?? '',
          changedAt: serverTimestamp(),
          note: payload.notes || null,
        };

        await updateDoc(doc(db, 'workOrders', woId), {
          status: 'SIGNED_OFF',
          statusHistory: arrayUnion(historyEntry),
          supervisorSignOffSignature: sigUrl,
          supervisorSignOffBy: user.uid,
          supervisorSignOffAt: serverTimestamp(),
          supervisorSignOffNotes: payload.notes || null,
          updatedAt: serverTimestamp(),
        });

        toast.success('Work order signed off and closed.');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sign-off failed';
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  return { signOff, loading, error };
}
