import { useEffect, useState } from 'react';
import { collection, query, where, getCountFromServer, getDocs, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { limitsForCompany, isAtOrOverLimit, seatTypeForRole, seatCountsFrom, LIGHT_USER_ROLES, type SeatType } from '../lib/planLimits';
import { PLAN_DISPLAY_NAME } from '../lib/planCatalog';

export type CountedResource = 'machines' | 'inventoryItems' | 'pmSchedules' | 'plants' | 'contractors' | 'trainingModules';

const RESOURCE_LABEL: Record<CountedResource, string> = {
  machines: 'machine',
  inventoryItems: 'inventory item',
  pmSchedules: 'PM schedule',
  plants: 'plant',
  contractors: 'contractor',
  trainingModules: 'training module',
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
  // Plants are company-level records every member can read; the rest are counted by
  // the server, because plant-scoped roles may only read their own plant's records.
  if (resource === 'plants' || resource === 'contractors' || resource === 'trainingModules') return countDirect(resource, companyId);
  return countViaServer(resource as UsageResource, companyId, () => countDirect(resource, companyId));
}

type UsageResource = 'machines' | 'inventoryItems' | 'pmSchedules' | 'breakdownsThisMonth' | 'workOrdersThisMonth';

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

async function countDirect(resource: CountedResource, companyId: string): Promise<number> {
  // Scrapped machines stay on record but no longer count against the plan.
  if (resource === 'machines') {
    const [all, scrapped] = await Promise.all([
      getCountFromServer(query(collection(db, 'machines'), where('siteId', '==', companyId))),
      getCountFromServer(query(collection(db, 'machines'), where('siteId', '==', companyId), where('status', '==', 'scrapped'))),
    ]);
    return Math.max(0, all.data().count - scrapped.data().count);
  }
  if (resource === 'plants') {
    const [all, off] = await Promise.all([
      getCountFromServer(query(collection(db, 'plants'), where('companyId', '==', companyId))),
      getCountFromServer(query(collection(db, 'plants'), where('companyId', '==', companyId), where('status', '==', 'inactive'))),
    ]);
    return Math.max(0, all.data().count - off.data().count);
  }
  if (resource === 'contractors') {
    return (await getCountFromServer(query(collection(db, 'contractors'), where('companyId', '==', companyId)))).data().count;
  }
  if (resource === 'trainingModules') {
    return (await getCountFromServer(query(collection(db, 'trainingModules'), where('companyId', '==', companyId)))).data().count;
  }
  const q =
    resource === 'inventoryItems'
      ? query(collection(db, 'inventoryParts'), where('companyId', '==', companyId))
      : query(
          collection(db, 'pm_schedules'),
          where('companyId', '==', companyId),
          where('status', 'in', ['active', 'paused']),
        );
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
  const inactive = where('status', '==', 'inactive');
  const [all, off, lightAll, lightOff, inviteSnap] = await Promise.all([
    getCountFromServer(query(members)),
    getCountFromServer(query(members, inactive)),
    getCountFromServer(query(members, where('role', 'in', light))),
    getCountFromServer(query(members, where('role', 'in', light), inactive)),
    getDocs(invites),
  ]);
  return seatCountsFrom({
    members: { all: all.data().count, inactive: off.data().count, light: lightAll.data().count, lightInactive: lightOff.data().count },
    invites: inviteSnap.docs.map((d) => ({
      role: d.get('role') as string | undefined,
      expiresAtMs: typeof d.get('expiresAt')?.toMillis === 'function' ? (d.get('expiresAt').toMillis() as number) : null,
    })),
  });
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

function useMonthlyCountLimit(opts: {
  collectionName: string;
  dateField: string;
  usage: UsageResource;
  limit: number | null;
  noun: string;
}): UsePlanLimitCheckResult {
  const { collectionName, dateField, usage, limit, noun } = opts;
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
    const direct = async () => {
      const q = query(
        collection(db, collectionName),
        where('siteId', '==', companyId),
        where(dateField, '>=', Timestamp.fromDate(startOfMonth)),
      );
      return (await getCountFromServer(q)).data().count;
    };
    countViaServer(usage, companyId, direct)
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        // Can't verify the live count: don't let a failed read bypass the plan limit.
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, limit, collectionName, dateField, usage]);

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
    usage: 'workOrdersThisMonth',
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
    usage: 'breakdownsThisMonth',
    limit: limitsForCompany(company).breakdownsPerMonth,
    noun: 'breakdown report',
  });
}

/** Ready-to-show text for a count limit that has been reached. */
function limitReachedMessage(limit: number, label: string, plan: string | undefined): string {
  if (limit === 0) return `Your ${planDisplayName(plan)} plan doesn't include ${label}s. Upgrade to add them.`;
  return `You've reached the ${limit} ${label} limit on your ${planDisplayName(plan)} plan. Upgrade to add more.`;
}

/**
 * Last-moment check, used at submit time by flows that don't render the limit hook
 * (PM schedule form, spare parts created from a machine…): would adding `adding` more
 * of this resource go past the company's limit? Returns the message to show, or null
 * when it is fine. A failed count blocks the action, same as the hook.
 */
export async function checkCanCreate(
  resource: CountedResource,
  company: Parameters<typeof limitsForCompany>[0],
  companyId: string,
  adding = 1,
): Promise<string | null> {
  const limit = limitsForCompany(company)[resource];
  if (limit === null) return null;
  try {
    const n = await fetchResourceCount(resource, companyId);
    if (n + adding > limit) return limitReachedMessage(limit, RESOURCE_LABEL[resource], company?.plan ?? undefined);
    return null;
  } catch {
    return `We couldn't verify your ${RESOURCE_LABEL[resource]} limit right now. Check your connection and try again.`;
  }
}

/**
 * Seat check for a person being added or changed: a new invitation, a role switch that
 * moves someone between full and light seats, or reactivating a deactivated account.
 * `from` is the user's current role/status (omit for a brand-new person).
 */
export async function checkSeatChange(opts: {
  company: Parameters<typeof limitsForCompany>[0];
  companyId: string;
  toRole: string | null | undefined;
  toStatus?: string | null;
  from?: { role: string | null | undefined; status?: string | null };
}): Promise<string | null> {
  const { company, companyId, toRole, from } = opts;
  if ((opts.toStatus ?? 'active') === 'inactive') return null; // a deactivated account takes no seat
  const seat = seatTypeForRole(toRole);
  const wasCounted = !!from && (from.status ?? 'active') !== 'inactive';
  if (wasCounted && seatTypeForRole(from?.role) === seat) return null; // same seat as before
  const limits = limitsForCompany(company);
  const limit = seat === 'light' ? limits.lightUsers : limits.fullUsers;
  if (limit === null) return null;
  try {
    const counts = await fetchSeatCounts(companyId);
    if (counts[seat] >= limit) {
      return `You've reached the ${limit} ${seat} user limit on your ${planDisplayName(company?.plan ?? undefined)} plan. Upgrade to add more.`;
    }
    return null;
  } catch {
    return "We couldn't verify your user limit right now. Check your connection and try again.";
  }
}

/** Thrown by assertWithinPlanLimit; its message is meant to be shown to the user as is. */
export class PlanLimitError extends Error {}

/**
 * Throws when creating `adding` more of a resource would pass the company's plan
 * limit. For create flows that have no hook (seeders, editors that save on first
 * change): call it right before the write.
 */
export async function assertWithinPlanLimit(
  resource: CountedResource,
  companyId: string,
  company: Parameters<typeof limitsForCompany>[0],
  adding = 1,
): Promise<void> {
  const message = await checkCanCreate(resource, company, companyId, adding);
  if (message) throw new PlanLimitError(message);
}

/** Like assertWithinPlanLimit, but returns the message (or null when allowed) instead of throwing. */
export async function checkPlanLimit(
  resource: CountedResource,
  companyId: string,
  company: Parameters<typeof limitsForCompany>[0],
  adding = 1,
): Promise<string | null> {
  return checkCanCreate(resource, company, companyId, adding);
}
