import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { InventorySettings } from '@/types/inventory';

interface UseInventorySettingsResult {
  settings: InventorySettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<Omit<InventorySettings, 'companyId' | 'updatedAt' | 'updatedBy'>>) => Promise<void>;
}

export function useInventorySettings(): UseInventorySettingsResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);

  const [settings, setSettings] = useState<InventorySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'inventorySettings', companyId),
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as InventorySettings);
        } else {
          setSettings(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const updateSettings = useCallback(
    async (updates: Partial<Omit<InventorySettings, 'companyId' | 'updatedAt' | 'updatedBy'>>) => {
      if (!companyId || !userId) {
        throw new Error('Not authenticated');
      }

      const ref = doc(db, 'inventorySettings', companyId);
      await setDoc(
        ref,
        {
          ...updates,
          companyId,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        },
        { merge: true }
      );
    },
    [companyId, userId]
  );

  return { settings, loading, error, updateSettings };
}
