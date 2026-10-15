import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
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

/**
 * One-off live count of a plan-limited resource for a company. Shared by the
 * hook and the bulk-import flows, so imports are checked against the same
 * number the single-create forms use.
 */
export async function fetchResourceCount(resource: CountedResource, companyId: string): Promise<number> {
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

/** Work orders created since the start of the current calendar month. */
export async function fetchMonthlyWorkOrderCount(companyId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const snap = await getCountFromServer(
    query(
      collection(db, 'workOrders'),
      where('siteId', '==', companyId),
      where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
    ),
  );
  return snap.data().count;
}

/**
 * For work orders the app creates on the user's behalf (e.g. an RCA's
 * corrective action): throws a readable error when the company has used up
 * its monthly work-order allowance, so those are held to the same cap as the
 * Create Work Order form. Resolves when the plan has room (or no cap).
 */
export async function assertMonthlyWorkOrderAllowed(): Promise<void> {
  const { company, userProfile } = useAuthStore.getState();
  const companyId = userProfile?.companyId ?? company?.id;
  const limit = limitsForCompany(company).workOrdersPerMonth;
  if (!companyId || limit === null) return;
  let count: number;
  try {
    count = await fetchMonthlyWorkOrderCount(companyId);
  } catch {
    // Can't verify the live count → don't let a failed read bypass the plan limit.
    throw new Error("We couldn't verify your monthly work order limit right now. Check your connection and try again.");
  }
  if (isAtOrOverLimit(count, limit)) {
    throw new Error(
      `You've reached the ${limit}/month work order limit on your ${planDisplayName(company?.plan)} plan. Upgrade to create more this month.`,
    );
  }
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
    fetchMonthlyWorkOrderCount(companyId)
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
