import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { TriageSession, TriageSessionStatus, TriageOutcomeType } from '../../types/triage';

export interface TriageHistoryFilters {
  machineId?: string;
  supervisorId?: string;
  status?: TriageSessionStatus;
  outcomeType?: TriageOutcomeType;
  from?: Date;
  to?: Date;
}

export function useTriageHistory(filters: TriageHistoryFilters = {}) {
  const [sessions, setSessions] = useState<TriageSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const constraints: any[] = [
      where('companyId', '==', companyId),
      orderBy('startedAt', 'desc'),
    ];
    if (filters.machineId) constraints.push(where('machineId', '==', filters.machineId));
    if (filters.supervisorId) constraints.push(where('supervisorId', '==', filters.supervisorId));
    if (filters.status) constraints.push(where('status', '==', filters.status));
    if (filters.outcomeType) constraints.push(where('outcomeType', '==', filters.outcomeType));
    if (filters.from) constraints.push(where('startedAt', '>=', Timestamp.fromDate(filters.from)));
    if (filters.to) constraints.push(where('startedAt', '<=', Timestamp.fromDate(filters.to)));

    const q = query(collection(db, 'triageSessions'), ...constraints);
    getDocs(q)
      .then((snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageSession)));
        setLoading(false);
      })
      .catch((err) => {
        console.error('useTriageHistory error:', err);
        setError(err.message);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, filters.machineId, filters.supervisorId, filters.status, filters.outcomeType]);

  return { sessions, loading, error };
}
