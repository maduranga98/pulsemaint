import { useState, useEffect, useCallback } from 'react';
import {
  fetchOngoingEvaluationsAndAudits,
  type OngoingActivityRow,
} from '../../services/teamPerformance.service';
import { usePlantUserIds } from '../usePlantUserIds';

export type { OngoingActivityRow };

export function useOngoingEvaluationsAndAudits(companyId: string) {
  const [evaluations, setEvaluations] = useState<OngoingActivityRow[]>([]);
  const [audits, setAudits] = useState<OngoingActivityRow[]>([]);
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
      const result = await fetchOngoingEvaluationsAndAudits(companyId);
      setEvaluations(result.evaluations);
      setAudits(result.audits);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Only this plant's people for plant-scoped roles / admin's plant tab.
  const plantUserIds = usePlantUserIds(companyId);
  const inPlant = (r: OngoingActivityRow) => !plantUserIds || (!!r.personId && plantUserIds.has(r.personId));
  return {
    evaluations: evaluations.filter(inPlant),
    audits: audits.filter(inPlant),
    loading,
    error,
    refetch: fetch,
  };
}
