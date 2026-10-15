import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { limitsForCompany, isAtOrOverLimit } from '../lib/planLimits';

export type CountedResource = 'machines' | 'inventoryItems' | 'pmSchedules' | 'users' | 'plants';

const RESOURCE_LABEL: Record<CountedResource, string> = {
  machines: 'machine',
  inventoryItems: 'inventory item',
  pmSchedules: 'PM schedule',
  users: 'user',
  plants: 'plant',
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

type UsageResource = CountedResource | 'workOrdersThisMonth';

/**
 * The company-wide count, from the getPlanUsage function: plan limits are per
 * company, but plant-scoped roles may only read their own plant's records.
 * Falls back to counting directly while the function isn't deployed yet.
 */
async function countViaServer(resource: UsageResource, companyId: string, direct: () => Promise<number>): Promise<number> {
  try {
    const call = httpsCallable<{ companyId: string; resource: UsageResource }, { count: number }>(functions, 'getPlanUsage');
    const res = await call({ companyId, resource });
    return Number(res.data.count) || 0;
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    if (code !== 'functions/not-found' && code !== 'functions/unimplemented') throw err;
    return direct();
  }
}

/**
 * One-off live count of a plan-limited resource for a company. Shared by the
 * hook and the bulk-import flows, so imports are checked against the same
 * number the single-create forms use.
 */
export async function fetchResourceCount(resource: CountedResource, companyId: string): Promise<number> {
  return countViaServer(resource, companyId, () => countDirect(resource, companyId));
}

async function countDirect(resource: CountedResource, companyId: string): Promise<number> {
  if (resource === 'users') {
    // Seats in use: everyone already in the company plus invitations still
    // waiting to be accepted — otherwise a full set of pending invites could
    // push the company past its limit once they all join.
    const [members, invited] = await Promise.all([
      getCountFromServer(query(collection(db, `companies/${companyId}/users`))),
      getCountFromServer(query(collection(db, `companies/${companyId}/invitations`), where('status', '==', 'pending'))),
    ]);
    return members.data().count + invited.data().count;
  }
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
      : resource === 'plants'
      ? query(collection(db, 'plants'), where('companyId', '==', companyId))
      : query(collection(db, `companies/${companyId}/users`));
  const snap = await getCountFromServer(q);
  return snap.data().count;
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
  const company = useAuthStore((s) => s.company);
  const plan = company?.plan;
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const limits = limitsForCompany(company);
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
    setFailed(false);

    fetchResourceCount(resource, companyId)
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        // Can't verify the live count → don't let a failed read bypass the plan limit.
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, resource, limit]);

  const atLimit = !loading && (failed || isAtOrOverLimit(count, limit));

  return {
    loading,
    count,
    limit,
    atLimit,
    message: failed
      ? `We couldn't verify your ${RESOURCE_LABEL[resource]} limit right now. Check your connection and try again.`
      : atLimit
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
  const company = useAuthStore((s) => s.company);
  const plan = company?.plan;
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const limit = limitsForCompany(company).workOrdersPerMonth;

  useEffect(() => {
    if (!companyId || limit === null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const direct = async () => {
      const q = query(
        collection(db, 'workOrders'),
        where('siteId', '==', companyId),
        where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
      );
      return (await getCountFromServer(q)).data().count;
    };
    countViaServer('workOrdersThisMonth', companyId, direct)
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, limit]);

  const atLimit = !loading && (failed || isAtOrOverLimit(count, limit));

  return {
    loading,
    count,
    limit,
    atLimit,
    message: failed
      ? "We couldn't verify your monthly work order limit right now. Check your connection and try again."
      : atLimit
      ? `You've reached the ${limit}/month work order limit on your ${planDisplayName(plan)} plan. Upgrade to create more this month.`
      : null,
  };
}
