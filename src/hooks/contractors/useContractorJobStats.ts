import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useContractorAccess } from './useContractorAccess';
import {
  aggregateContractorJobStats,
  type ContractorJobStatRow,
  type ContractorJobStats,
} from '@/lib/contractors/contractorJobStats';

type JobRow = ContractorJobStatRow<Timestamp>;

export type { ContractorJobStats };

/**
 * Live per-contractor job stats, keyed by contractorId.
 *
 * The registry's Jobs / Last Job / Rating columns read the denormalized
 * `totalJobsCount`, `lastJobDate`, and `avgRating` fields on the contractor
 * document. Those are only ever written by `syncContractorMetrics`, which
 * recomputes from `contractorJobs` — a collection nothing in the app creates,
 * because contractor work is raised as a CONTRACTOR work order. So the
 * counters never moved: Jobs sat at 0 and Last Job at "Never" no matter how
 * much work a contractor had done.
 *
 * Computing from the live data instead means the columns update the moment a
 * contractor work order is raised or signed off, with no counter to drift.
 * Both sources are counted, so any `contractorJobs` records that do exist
 * (seeded or written by a backend job) still contribute.
 */
export function useContractorJobStats(): {
  stats: Record<string, ContractorJobStats<Timestamp>>;
  loading: boolean;
} {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const siteId = useAuthStore((s) => s.userProfile?.siteIds?.[0]) ?? companyId;
  // hr_officer reaches the registry but firestore.rules gives them neither
  // workOrders nor contractorJobs — don't open listeners that can only be
  // denied; they keep the stored counters as the fallback, as before.
  const { canReadRegistry } = useContractorAccess();

  const [woRows, setWoRows] = useState<JobRow[]>([]);
  const [jobRows, setJobRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId || !canReadRegistry) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'workOrders'), where('siteId', '==', siteId), where('woType', '==', 'CONTRACTOR')),
      (snap) => {
        setWoRows(
          snap.docs
            .map((d) => d.data())
            .filter((data) => !!data.contractorCompanyId)
            .map((data) => ({
              contractorId: String(data.contractorCompanyId),
              at:
                (data.supervisorSignOffAt as Timestamp | null) ??
                (data.actualEndTime as Timestamp | null) ??
                (data.createdAt as Timestamp | null) ??
                null,
              rating:
                typeof data.contractorRating?.overallScore === 'number'
                  ? data.contractorRating.overallScore
                  : null,
            })),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [siteId, canReadRegistry]);

  useEffect(() => {
    if (!companyId || !canReadRegistry) return;
    const unsub = onSnapshot(
      query(collection(db, 'contractorJobs'), where('companyId', '==', companyId)),
      (snap) => {
        setJobRows(
          snap.docs
            .map((d) => d.data())
            .filter((data) => !!data.contractorId)
            .map((data) => ({
              contractorId: String(data.contractorId),
              at:
                (data.signedOffAt as Timestamp | null) ??
                (data.workCompletedAt as Timestamp | null) ??
                (data.createdAt as Timestamp | null) ??
                null,
              rating:
                typeof data.rating?.overallScore === 'number' ? data.rating.overallScore : null,
            })),
        );
      },
      () => setJobRows([]),
    );
    return () => unsub();
  }, [companyId, canReadRegistry]);

  const stats = useMemo(
    () => aggregateContractorJobStats([...woRows, ...jobRows]),
    [woRows, jobRows],
  );

  return { stats, loading };
}
