import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ConditionReading, ConditionReadingDraft } from '../types/conditionMonitoring';

interface UseConditionReadingsParams {
  machineId: string;
  siteId: string;
}

interface UseConditionReadingsResult {
  readings: ConditionReading[];
  loading: boolean;
  error: string | null;
  parameterGroups: Record<string, ConditionReading[]>;
  addReading: (draft: ConditionReadingDraft, uid: string, userName: string) => Promise<void>;
}

export function useConditionReadings({ machineId, siteId }: UseConditionReadingsParams): UseConditionReadingsResult {
  const [readings, setReadings] = useState<ConditionReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!machineId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'conditionReadings'),
      where('machineId', '==', machineId),
      orderBy('takenAt', 'desc'),
      limit(500),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ConditionReading));
        setReadings(docs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [machineId]);

  const parameterGroups = useMemo(() => {
    const groups: Record<string, ConditionReading[]> = {};
    for (const r of readings) {
      if (!groups[r.parameter]) groups[r.parameter] = [];
      groups[r.parameter].push(r);
    }
    return groups;
  }, [readings]);

  const addReading = useCallback(
    async (draft: ConditionReadingDraft, uid: string, userName: string) => {
      await addDoc(collection(db, 'conditionReadings'), {
        machineId,
        siteId,
        parameter: draft.parameter,
        value: draft.value === '' ? 0 : draft.value,
        unit: draft.unit,
        min: draft.min === '' ? null : draft.min,
        max: draft.max === '' ? null : draft.max,
        takenBy: uid,
        takenByName: userName,
        takenAt: serverTimestamp(),
      });
    },
    [machineId, siteId],
  );

  return { readings, loading, error, parameterGroups, addReading };
}
