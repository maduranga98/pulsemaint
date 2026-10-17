import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { limitsForCompany, isAtOrOverLimit, LIGHT_USER_ROLES, isLightUserRole, type PlanLimitCompany } from '../lib/planLimits';
import { PLAN_DISPLAY_NAME } from '../lib/planCatalog';

export type CountedResource =
  | 'machines' | 'inventoryItems' | 'pmSchedules' | 'users' | 'lightUsers' | 'plants' | 'contractors' | 'trainingModules';

const RESOURCE_LABEL: Record<CountedResource, string> = {
  machines: 'machine',
  inventoryItems: 'inventory item',
  pmSchedules: 'PM schedule',
  users: 'full user',
  lightUsers: 'light user (operator / trainee)',
  plants: 'plant',
  contractors: 'contractor',
  trainingModules: 'training module',
};

interface UsePlanLimitCheckResult {
  loading: boolean;
  count: number;
  limit: number | null;
  atLimit: boolean;
  /** e.g. "You've reached the 15 machine limit on your Starter plan." — ready to show in a banner/toast. */
  message: string | null;
}

function planDisplayName(plan: string | undefined): string {
  return PLAN_DISPLAY_NAME[(plan ?? 'starter') as keyof typeof PLAN_DISPLAY_NAME] ?? 'Starter';
}

/**
 * One-off live count of a plan-limited resource for a company. Shared by the
 * hook and the bulk-import flows, so imports are checked against the same
 * number the single-create forms use.
 */
export async function fetchResourceCount(resource: CountedResource, companyId: string): Promise<number> {
  if (resource === 'users' || resource === 'lightUsers') {
    // Seats in use: everyone already in the company plus invitations still
    // waiting to be accepted — otherwise a full set of pending invites could
    // push the company past its limit once they all join. Floor operators and
    // trainees are light users with their own cap; every other role is a full user.
    const members = collection(db, `companies/${companyId}/users`);
    const [allMembers, lightMembers, invites] = await Promise.all([
      getCountFromServer(query(members)),
      getCountFromServer(query(members, where('role', 'in', [...LIGHT_USER_ROLES]))),
      getDocs(query(collection(db, `companies/${companyId}/invitations`), where('status', '==', 'pending'))),
    ]);
    const lightInvites = invites.docs.filter((d) => isLightUserRole(d.get('role'))).length;
    const light = lightMembers.data().count + lightInvites;
    const total = allMembers.data().count + invites.size;
    return resource === 'lightUsers' ? light : total - light;
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
      : resource === 'contractors'
      ? query(collection(db, 'contractors'), where('companyId', '==', companyId))
      : query(collection(db, 'trainingModules'), where('companyId', '==', companyId));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/** Thrown by assertWithinPlanLimit — its message is meant to be shown to the user as is. */
export class PlanLimitError extends Error {}

/**
 * Throws when creating `adding` more of a resource would pass the company's
 * plan limit. For create flows that have no hook (seeders, editors that save
 * on first change): call it right before the write.
 */
export async function assertWithinPlanLimit(
  resource: CountedResource,
  companyId: string,
  company: PlanLimitCompany | null | undefined,
  adding = 1,
): Promise<void> {
  const limit = limitsForCompany(company)[resource];
  if (limit === null) return;
  let count: number;
  try {
    count = await fetchResourceCount(resource, companyId);
  } catch {
    throw new PlanLimitError(`We couldn't verify your ${RESOURCE_LABEL[resource]} limit right now. Check your connection and try again.`);
  }
  if (count + adding > limit) {
    throw new PlanLimitError(
      limit === 0
        ? `Your ${planDisplayName(company?.plan ?? undefined)} plan doesn't include ${RESOURCE_LABEL[resource]}s. Upgrade to add them.`
        : `You've reached the ${limit} ${RESOURCE_LABEL[resource]} limit on your ${planDisplayName(company?.plan ?? undefined)} plan. Upgrade to add more.`,
    );
  }
}

/** Like assertWithinPlanLimit, but returns the message (or null when allowed) instead of throwing. */
export async function checkPlanLimit(
  resource: CountedResource,
  companyId: string,
  company: PlanLimitCompany | null | undefined,
  adding = 1,
): Promise<string | null> {
  try {
    await assertWithinPlanLimit(resource, companyId, company, adding);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Plan limit reached.';
  }
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

function useMonthlyCountLimit(opts: {
  collectionName: string;
  dateField: string;
  limit: number | null;
  noun: string;
}): UsePlanLimitCheckResult {
  const { collectionName, dateField, limit, noun } = opts;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const plan = useAuthStore((s) => s.company?.plan);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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
    const q = query(
      collection(db, collectionName),
      where('siteId', '==', companyId),
      where(dateField, '>=', Timestamp.fromDate(startOfMonth)),
    );
    getCountFromServer(q)
      .then((snap) => {
        if (!cancelled) setCount(snap.data().count);
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
  }, [companyId, limit, collectionName, dateField]);

  const atLimit = !loading && (failed || isAtOrOverLimit(count, limit));

  return {
    loading,
    count,
    limit,
    atLimit,
    message: failed
      ? `We couldn't verify your monthly ${noun} limit right now. Check your connection and try again.`
      : atLimit
      ? `You've reached the ${limit}/month ${noun} limit on your ${planDisplayName(plan)} plan. Upgrade to create more this month.`
      : null,
  };
}

/** Work orders created since the start of this calendar month vs the plan's workOrdersPerMonth cap. */
export function useMonthlyWorkOrderLimitCheck(): UsePlanLimitCheckResult {
  const company = useAuthStore((s) => s.company);
  return useMonthlyCountLimit({
    collectionName: 'workOrders',
    dateField: 'createdAt',
    limit: limitsForCompany(company).workOrdersPerMonth,
    noun: 'work order',
  });
}

/** Breakdown reports raised since the start of this calendar month vs the plan's breakdownsPerMonth cap. */
export function useMonthlyBreakdownLimitCheck(): UsePlanLimitCheckResult {
  const company = useAuthStore((s) => s.company);
  return useMonthlyCountLimit({
    collectionName: 'breakdown_tickets',
    dateField: 'reportedAt',
    limit: limitsForCompany(company).breakdownsPerMonth,
    noun: 'breakdown report',
  });
}
