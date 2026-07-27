import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { fetchSessionsByContractor } from '@/modules/audit/services/audit.service';
import type { Timestamp } from 'firebase/firestore';

export interface ContractorAuditRatingRow {
  jobId: string;
  workOrderNumber: string;
  rating: number;
  notes: string;
  sessionId: string;
  auditorName: string;
  auditDate: string;
  submittedAt: Timestamp | null;
}

/**
 * Flattens `contractorJobRatings` out of every Contractor Audit session that
 * rated the given contractor (found via the denormalized `contractorIds`
 * array-contains query), for display on the Contractor Profile page.
 */
export function useContractorAuditRatings(contractorId?: string) {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [ratings, setRatings] = useState<ContractorAuditRatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !contractorId) {
      setRatings([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSessionsByContractor(companyId, contractorId)
      .then((sessions) => {
        if (cancelled) return;
        const rows: ContractorAuditRatingRow[] = sessions.flatMap((session) =>
          (session.contractorJobRatings ?? [])
            .filter((r) => r.contractorId === contractorId)
            .map((r) => ({
              jobId: r.jobId,
              workOrderNumber: r.workOrderNumber,
              rating: r.rating,
              notes: r.notes,
              sessionId: session.id,
              auditorName: session.auditorName,
              auditDate: session.auditDate,
              submittedAt: session.submittedAt,
            })),
        );
        setRatings(rows);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, contractorId]);

  return { ratings, loading, error };
}
