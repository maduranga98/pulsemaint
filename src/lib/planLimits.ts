import type { CompanyProfile } from '../types/auth';

export type Plan = CompanyProfile['plan'];

export interface PlanLimitConfig {
  /** null = unlimited. */
  machines: number | null;
  inventoryItems: number | null;
  pmSchedules: number | null;
  workOrdersPerMonth: number | null;
  users: number | null;
  features: {
    /** Inventory: automatic PO email to suppliers. */
    autoPOEmail: boolean;
    /** Inventory: QR scan & low-stock alerts. */
    qrLowStockAlerts: boolean;
    contractors: boolean;
    shiftHandover: boolean;
    training: boolean;
    safety: boolean;
    moeAnalytics: boolean;
    multiSite: boolean;
  };
}

// Single source of truth for plan limits/features — kept in sync with the
// customer-facing pricing sheet (FirmiCore-Customer-Booklet.pdf) and mirrored
// in BillingPage's plan cards. Anything gated here should read from here
// rather than hardcoding numbers/flags at the call site, so the two never
// drift apart again.
export const PLAN_LIMITS: Record<Plan, PlanLimitConfig> = {
  starter: {
    machines: 10,
    inventoryItems: 10,
    pmSchedules: 10,
    workOrdersPerMonth: 50,
    users: 5,
    features: {
      autoPOEmail: false,
      qrLowStockAlerts: false,
      contractors: false,
      shiftHandover: false,
      training: false,
      safety: false,
      moeAnalytics: false,
      multiSite: false,
    },
  },
  workshop: {
    machines: 100,
    inventoryItems: 10000,
    pmSchedules: null,
    workOrdersPerMonth: null,
    users: 20,
    features: {
      autoPOEmail: true,
      qrLowStockAlerts: true,
      contractors: true,
      shiftHandover: true,
      training: true,
      safety: true,
      moeAnalytics: false,
      multiSite: false,
    },
  },
  factory: {
    machines: 1500,
    inventoryItems: null,
    pmSchedules: null,
    workOrdersPerMonth: null,
    users: 100,
    features: {
      autoPOEmail: true,
      qrLowStockAlerts: true,
      contractors: true,
      shiftHandover: true,
      training: true,
      safety: true,
      moeAnalytics: true,
      multiSite: false,
    },
  },
  enterprise: {
    machines: null,
    inventoryItems: null,
    pmSchedules: null,
    workOrdersPerMonth: null,
    users: null,
    features: {
      autoPOEmail: true,
      qrLowStockAlerts: true,
      contractors: true,
      shiftHandover: true,
      training: true,
      safety: true,
      moeAnalytics: true,
      multiSite: true,
    },
  },
};

export function planLimitsFor(plan: Plan | undefined | null): PlanLimitConfig {
  // `plan` ultimately comes from a Firestore field that isn't otherwise
  // validated client-side (e.g. set by hand in the console, or a future
  // plan id this build doesn't know about yet) — an unrecognized value
  // must not crash every PlanFeatureGate-protected page with "Cannot read
  // properties of undefined (reading 'features')".
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.starter;
}

export function isAtOrOverLimit(count: number, limit: number | null): boolean {
  if (limit === null) return false;
  return count >= limit;
}

/** Hard cap on data rows in a single bulk-import file (CSV or Excel). */
export const MAX_IMPORT_ROWS = 500;

/** Hard cap on the size of a bulk-import file. */
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

export type ImportBlockReason = 'too_many_rows' | 'file_too_large' | 'plan_limit';

export interface ImportCheck {
  ok: boolean;
  reason?: ImportBlockReason;
  /** How many more records the plan allows right now (null = unlimited). */
  remaining: number | null;
}

/**
 * Decides whether a bulk import of `newRecords` may proceed. A file over the
 * per-file row/size caps, or one that would push `existingCount` past the
 * plan `limit`, is rejected whole — never partially imported — so CSV/Excel
 * can't be used to get around the limits enforced on the single-create forms.
 */
export function checkImportAllowed(opts: {
  /** Records that would actually be created (valid rows). */
  newRecords: number;
  /** All data rows in the file, valid or not — defaults to newRecords. */
  totalRows?: number;
  existingCount: number;
  limit: number | null;
  fileBytes?: number;
}): ImportCheck {
  const { newRecords, existingCount, limit, fileBytes } = opts;
  const totalRows = opts.totalRows ?? newRecords;
  const remaining = limit === null ? null : Math.max(0, limit - existingCount);
  if (fileBytes !== undefined && fileBytes > MAX_IMPORT_FILE_BYTES) {
    return { ok: false, reason: 'file_too_large', remaining };
  }
  if (totalRows > MAX_IMPORT_ROWS) {
    return { ok: false, reason: 'too_many_rows', remaining };
  }
  if (remaining !== null && newRecords > remaining) {
    return { ok: false, reason: 'plan_limit', remaining };
  }
  return { ok: true, remaining };
}

/** User-facing explanation for a blocked import. */
export function importBlockMessage(
  check: ImportCheck,
  label: string,
  limit: number | null,
  newRecords: number,
  totalRows: number = newRecords,
): string {
  switch (check.reason) {
    case 'file_too_large':
      return `File is too large. Maximum import file size is ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)} MB.`;
    case 'too_many_rows':
      return `This file has ${totalRows} rows. A single import is limited to ${MAX_IMPORT_ROWS} rows — split it into smaller files.`;
    case 'plan_limit':
      return `Import blocked: ${newRecords} new ${label}(s) would exceed your plan limit of ${limit}. You can add ${check.remaining} more. Remove rows or upgrade your plan.`;
    default:
      return '';
  }
}

type FeatureKey = keyof PlanLimitConfig['features'];

/** Just the company fields the plan checks read — keeps these helpers pure and testable. */
export interface PlanCompanyState {
  plan?: Plan | null;
  status?: string | null;
  trialEndsAt?: { toMillis: () => number } | null;
  stripeSubscriptionId?: string | null;
  planSetBy?: string | null;
}

/** On a free trial that has run out (no subscription, no plan assigned by Lumora). */
export function isTrialExpired(company: PlanCompanyState | null | undefined, now: number = Date.now()): boolean {
  if (!company || company.status !== 'trial') return false;
  if (company.stripeSubscriptionId || company.planSetBy === 'platform') return false;
  const end = company.trialEndsAt?.toMillis?.();
  return typeof end === 'number' && end <= now;
}

/**
 * Whether the company can use a plan-gated feature. A running trial unlocks
 * every feature (except multi-site) so companies can try the product; the
 * numeric limits (machines, users…) still follow the Starter plan.
 */
export function isFeatureAvailable(company: PlanCompanyState | null | undefined, feature: FeatureKey): boolean {
  if (company?.status === 'trial' && !isTrialExpired(company)) {
    return feature === 'multiSite' ? false : true;
  }
  return planLimitsFor(company?.plan).features[feature];
}

// Route prefixes that belong to a plan-gated feature. Trainees, floor
// operators etc. reach /app/training/my-* too, so the whole prefix is gated —
// a plan without Training has no assigned trainings to open.
const FEATURE_PATH_PREFIXES: Array<[string, FeatureKey]> = [
  ['/app/contractors', 'contractors'],
  ['/app/shift/handover', 'shiftHandover'],
  ['/app/training', 'training'],
  ['/app/safety', 'safety'],
  ['/app/moe', 'moeAnalytics'],
];

/** The plan feature a path belongs to, or null when it isn't plan-gated. */
export function featureForPath(pathname: string): FeatureKey | null {
  for (const [prefix, feature] of FEATURE_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return feature;
  }
  return null;
}
