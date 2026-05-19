import { useState, useEffect } from 'react';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Machine } from '../types/machine';

interface UseMachineOptions {
  siteId: string;
  machineId: string;
}

interface UseMachineResult {
  machine: Machine | null;
  loading: boolean;
  error: string | null;
}

export function useMachine({ siteId, machineId }: UseMachineOptions): UseMachineResult {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId || !machineId) {
      setError('Site ID and Machine ID are required');
      setLoading(false);
      return;
    }

    setLoading(true);
    const machineRef = doc(db, 'machines', machineId);

    const unsubscribe: Unsubscribe = onSnapshot(
      machineRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          // Verify the machine belongs to this site
          if (data.siteId === siteId) {
            setMachine({
              id: snapshot.id,
              ...data,
            } as Machine);
            setError(null);
          } else {
            setError('Machine not found or access denied');
            setMachine(null);
          }
        } else {
          setError('Machine not found');
          setMachine(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching machine:', err);
        setError(err.message || 'Failed to fetch machine');
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [siteId, machineId]);

  return { machine, loading, error };
}
