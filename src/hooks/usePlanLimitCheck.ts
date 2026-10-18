import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { limitsForCompany, isAtOrOverLimit, seatTypeForRole, LIGHT_USER_ROLES, type SeatType } from '../lib/planLimits';
import { PLAN_DISPLAY_NAME } from '../lib/planCatalog';

export type CountedResource = 'machines' | 'inventoryItems' | 'pmSchedules' | 'plants';

const RESOURCE_LABEL: Record<CountedResource, string> = {
  machines: 'machine',
  inventoryItems: 'inventory item',
  pmSchedules: 'PM schedule',
  plants: 'plant',
};

interface UsePlanLimitCheckResult {
  loading: boolean;
  count: number;
  limit: number | null;
  atLimit: boolean;
  /** e.g. "You've reached the 10 machine limit on your Starter plan." — ready to show in a banner/toast. */
  message: string | null;
}

function planDisplayName(plan: string | undefined): string {
  return PLAN_DISPLAY_NAME[plan as keyof typeof PLAN_DISPLAY_NAME] ?? PLAN_DISPLAY_NAME.starter;
}

/**
 * One-off live count of a plan-limited resource for a company. Shared by the
 * hook and the bulk-import flows, so imports are checked against the same
 * number the single-create forms use.
 */
export async function fetchResourceCount(resource: CountedResource, companyId: string): Promise<number> {
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
      : query(collection(db, 'plants'), where('companyId', '==', companyId));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export interface SeatCounts {
  full: number;
  light: number;
}

/**
 * Seats in use: everyone already in the company plus invitations still
 * waiting to be accepted — otherwise a full set of pending invites could push
 * the company past its limit once they all join. Light seats are the
 * floor-operator and trainee roles, everything else is a full seat.
 */
export async function fetchSeatCounts(companyId: string): Promise<SeatCounts> {
  const members = collection(db, `companies/${companyId}/users`);
  const invites = query(collection(db, `companies/${companyId}/invitations`), where('status', '==', 'pending'));
  const light = [...LIGHT_USER_ROLES];
  const [mAll, mLight, iAll, iLight] = await Promise.all([
    getCountFromServer(query(members)),
    getCountFromServer(query(members, where('role', 'in', light))),
    getCountFromServer(invites),
    getCountFromServer(query(invites, where('role', 'in', light))),
  ]);
  const lightCount = mLight.data().count + iLight.data().count;
  return { full: mAll.data().count + iAll.data().count - lightCount, light: lightCount };
}

export interface SeatUsage {
  loading: boolean;
  counts: SeatCounts;
  limits: { full: number | null; light: number | null };
  /** Seats still free for a seat type (null = unlimited). */
  remaining: (seat: SeatType) => number | null;
  /** Whether one more user with this role fits — false while the live count can't be verified. */
  canAdd: (role: string | null | undefined) => boolean;
  /** Ready-to-show reason a user with this role can't be added, or null. */
  messageFor: (role: string | null | undefined) => string | null;
}

/**
 * Live full/light seat usage against the plan. Replaces the old single
 * "total users" cap: Starter 3 full + 10 light, Growth 10 + 50, and so on.
 */
export function useSeatUsage(): SeatUsage {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const company = useAuthStore((s) => s.company);
  const [counts, setCounts] = useState<SeatCounts>({ full: 0, light: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const limits = limitsForCompany(company);
  const fullLimit = limits.fullUsers;
  const lightLimit = limits.lightUsers;

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetchSeatCounts(companyId)
      .then((c) => {
        if (!cancelled) setCounts(c);
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
  }, [companyId, fullLimit, lightLimit]);

  const limitOf = (seat: SeatType) => (seat === 'light' ? lightLimit : fullLimit);
  const remaining = (seat: SeatType) => {
    const limit = limitOf(seat);
    return limit === null ? null : Math.max(0, limit - counts[seat]);
  };
  const messageFor = (role: string | null | undefined): string | null => {
    const seat = seatTypeForRole(role);
    if (failed) return "We couldn't verify your user limit right now. Check your connection and try again.";
    if (loading || remaining(seat) !== 0) return null;
    return `You've reached the ${limitOf(seat)} ${seat} user limit on your ${planDisplayName(company?.plan)} plan. Upgrade to add more.`;
  };
  return {
    loading,
    counts,
    limits: { full: fullLimit, light: lightLimit },
    remaining,
    canAdd: (role) => !loading && !failed && remaining(seatTypeForRole(role)) !== 0,
    messageFor,
  };
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
 * count, and no plan caps it any more (null = unlimited).
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
