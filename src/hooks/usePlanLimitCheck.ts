import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { planLimitsFor, isAtOrOverLimit } from '../lib/planLimits';

type CountedResource = 'machines' | 'inventoryItems' | 'pmSchedules' | 'users';

const RESOURCE_LABEL: Record<CountedResource, string> = {
  machines: 'machine',
  inventoryItems: 'inventory item',
  pmSchedules: 'PM schedule',
  users: 'user',
};

interface UsePlanLimitCheckResult {
  loading: boolean;
  count: number;
  limit: number | null;
  atLimit: boolean;
  /** e.g. "You've reached the 10 machine limit on your Basic plan." — ready to show in a banner/toast. */
  message: string | null;
}

function planDisplayName(plan: string | undefined): string {
  if (!plan) return 'Basic';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

/**
 * Live count of a resource against the company's current plan limit
 * (PLAN_LIMITS in lib/planLimits.ts). Used right before a create action to
 * decide whether to block it and prompt an upgrade instead.
 * `getCountFromServer` reads only an aggregate, not the documents
 * themselves, so this is cheap to call from a creation form without loading
 * full lists. Each resource lives in a differently-scoped collection —
 * machines/workOrders use `siteId`, inventory/pm_schedules use `companyId`,
 * users are a `companies/{companyId}/users` subcollection — so the query is
 * built per resource rather than through one generic field mapping.
 */
export function usePlanLimitCheck(resource: CountedResource): UsePlanLimitCheckResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const plan = useAuthStore((s) => s.company?.plan);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const limits = planLimitsFor(plan);
  const limit = limits[resource];

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    // Unlimited on this plan — skip the read entirely.
    if (limit === null) {
      setLoading(false);
      setCount(0);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const q =
      resource === 'machines'
        ? query(collection(db, 'machines'), where('siteId', '==', companyId))
        : resource === 'inventoryItems'
        ? query(collection(db, 'inventoryParts'), where('companyId', '==', companyId))
        : resource === 'pmSchedules'
        ? query(
            collection(db, 'pm_schedules'),
            where('companyId', '==', companyId),
            where('status', 'in', ['active', 'paused']),
          )
        : query(collection(db, `companies/${companyId}/users`));

    getCountFromServer(q)
      .then((snap) => {
        if (!cancelled) setCount(snap.data().count);
      })
      .catch(() => {
        // Permission/index error — don't block creation on a failed read.
        if (!cancelled) setCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, resource, limit]);

  const atLimit = !loading && isAtOrOverLimit(count, limit);

  return {
    loading,
    count,
    limit,
    atLimit,
    message: atLimit
      ? `You've reached the ${limit} ${RESOURCE_LABEL[resource]} limit on your ${planDisplayName(plan)} plan. Upgrade to add more.`
      : null,
  };
}

/**
 * Live count of work orders created since the start of the current calendar
 * month, checked against the plan's workOrdersPerMonth cap. Kept separate
 * from usePlanLimitCheck because it's a range query, not a plain equality
 * count, and only Basic has a cap at all (everything else is unlimited).
 */
export function useMonthlyWorkOrderLimitCheck(): UsePlanLimitCheckResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const plan = useAuthStore((s) => s.company?.plan);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const limit = planLimitsFor(plan).workOrdersPerMonth;

  useEffect(() => {
    if (!companyId || limit === null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, 'workOrders'),
      where('siteId', '==', companyId),
      where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
    );
    getCountFromServer(q)
      .then((snap) => {
        if (!cancelled) setCount(snap.data().count);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, limit]);

  const atLimit = !loading && isAtOrOverLimit(count, limit);

  return {
    loading,
    count,
    limit,
    atLimit,
    message: atLimit
      ? `You've reached the ${limit}/month work order limit on your ${planDisplayName(plan)} plan. Upgrade to create more this month.`
      : null,
  };
}
