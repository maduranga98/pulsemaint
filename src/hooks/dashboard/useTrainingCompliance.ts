import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TrainingComplianceStats, ComplianceByMachine, OperatorTrainingStatus } from '../../types/analytics.types';

export function useTrainingCompliance(companyId: string) {
  const [stats, setStats] = useState<TrainingComplianceStats>({
    overallComplianceRate: 0,
    certificationsExpiring30Days: 0,
    certificationsExpired: 0,
    traineesInProgress: 0,
  });
  const [byMachine, setByMachine] = useState<ComplianceByMachine[]>([]);
  const [operators, setOperators] = useState<OperatorTrainingStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Training records
      const recordsSnap = await getDocs(
        query(collection(db, 'training_records'), where('companyId', '==', companyId))
      );
      const records = recordsSnap.docs.map((d) => d.data());

      // Calculate stats
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      let expired = 0;
      let expiring = 0;
      let inProgress = 0;

      for (const r of records) {
        const expiry = r.expiryDate?.toMillis?.() ?? 0;
        if (expiry < now) expired++;
        else if (expiry - now < thirtyDays) expiring++;
        if (r.status === 'in_progress') inProgress++;
      }

      const total = records.length || 1;
      const valid = records.filter((r) => {
        const expiry = r.expiryDate?.toMillis?.() ?? 0;
        return expiry > now;
      }).length;

      setStats({
        overallComplianceRate: Math.round((valid / total) * 100),
        certificationsExpiring30Days: expiring,
        certificationsExpired: expired,
        traineesInProgress: inProgress,
      });

      // Placeholder for machine compliance and operators
      setByMachine([]);
      setOperators([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { stats, byMachine, operators, loading, error, refetch: fetch };
}
