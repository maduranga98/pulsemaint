import type { CompanyProfile } from '../types/auth';

export type Plan = CompanyProfile['plan'];

/** The count limits a plan carries. null = unlimited. */
export interface PlanCountLimits {
  /** Full users: every role except the light (view/report-only) roles. */
  fullUsers: number | null;
  /** Light users: floor operators and trainees (see LIGHT_USER_ROLES). */
  lightUsers: number | null;
  /** Plants registered in the company. */
  plants: number | null;
  machines: number | null;
  inventoryItems: number | null;
  pmSchedules: number | null;
  workOrdersPerMonth: number | null;
  /** Breakdown reports raised per calendar month. */
  breakdownsPerMonth: number | null;
  /** Registered contractors (contractors and training modules each have their own cap). */
  contractors: number | null;
  /** Training modules authored (both libraries together). */
  trainingModules: number | null;
  /** AI credits per month: 1 = a normal suggestion, 6 = one with web research. */
  aiCreditsPerMonth: number | null;
  /** How many months back Analytics and reports can look. */
  analyticsHistoryMonths: number | null;
}

/** Roles that take a light seat; every other role takes a full seat. */
export const LIGHT_USER_ROLES = ['floor_operator', 'trainee'] as const;

/** AI credit cost of one request: a normal suggestion is 1, one with web research is 6. */
export const AI_CREDIT_COST = { standard: 1, webResearch: 6 } as const;

export type SeatType = 'full' | 'light';

export function seatTypeForRole(role: string | null | undefined): SeatType {
  return (LIGHT_USER_ROLES as readonly string[]).includes(role ?? '') ? 'light' : 'full';
}

export type CountLimitKey = keyof PlanCountLimits;

export interface PlanLimitConfig extends PlanCountLimits {
  features: {
    /** Inventory: automatic PO email to suppliers. */
    autoPOEmail: boolean;
    /** Inventory: QR scan & low-stock alerts. */
    qrLowStockAlerts: boolean;
    /** Inventory: purchase orders. */
    purchaseOrders: boolean;
    contractors: boolean;
    shiftHandover: boolean;
    training: boolean;
    safety: boolean;
    kaizen: boolean;
    evaluations: boolean;
    /** Analytics page, reports hub, report exports and Google Sheets export. */
    analyticsReports: boolean;
    /** AI root-cause suggestions and translation. */
    aiAssist: boolean;
    moeAnalytics: boolean;
    /** Analytics: plants + team tabs, scheduled reports. */
    advancedAnalytics: boolean;
    audits: boolean;
  };
}

// Single source of truth for plan limits/features — kept in sync with the
// customer-facing pricing sheet and mirrored in BillingPage's plan cards and
// the platform console's plan tables (see planCatalog.ts for prices). Anything
// gated here should read from here rather than hardcoding numbers/flags at the
// call site, so the two never drift apart again. Storage is not limited.
export const PLAN_LIMITS: Record<Plan, PlanLimitConfig> = {
  starter: {
    fullUsers: 3,
    lightUsers: 10,
    plants: 1,
    machines: 15,
    inventoryItems: 100,
    pmSchedules: 30,
    workOrdersPerMonth: 60,
    breakdownsPerMonth: 40,
    contractors: 0,
    trainingModules: 0,
    aiCreditsPerMonth: 20,
    analyticsHistoryMonths: 12,
    features: {
      autoPOEmail: false,
      qrLowStockAlerts: false,
      purchaseOrders: true,
      contractors: false,
      shiftHandover: false,
      training: false,
      safety: false,
      kaizen: false,
      evaluations: false,
      analyticsReports: true,
      aiAssist: true,
      moeAnalytics: false,
      advancedAnalytics: false,
      audits: false,
    },
  },
  workshop: {
    fullUsers: 10,
    lightUsers: 50,
    plants: 3,
    machines: 75,
    inventoryItems: 2000,
    pmSchedules: 400,
    workOrdersPerMonth: 400,
    breakdownsPerMonth: 300,
    contractors: 25,
    trainingModules: 25,
    aiCreditsPerMonth: 150,
    analyticsHistoryMonths: 36,
    features: {
      autoPOEmail: true,
      qrLowStockAlerts: true,
      purchaseOrders: true,
      contractors: true,
      shiftHandover: true,
      training: true,
      safety: true,
      kaizen: false,
      evaluations: false,
      analyticsReports: true,
      aiAssist: true,
      moeAnalytics: false,
      advancedAnalytics: false,
      audits: false,
    },
  },
  factory: {
    fullUsers: 40,
    lightUsers: 250,
    plants: 5,
    machines: 400,
    inventoryItems: 10000,
    pmSchedules: 3000,
    workOrdersPerMonth: 2500,
    breakdownsPerMonth: 2000,
    contractors: 250,
    trainingModules: 250,
    aiCreditsPerMonth: 800,
    analyticsHistoryMonths: null,
    features: {
      autoPOEmail: true,
      qrLowStockAlerts: true,
      purchaseOrders: true,
      contractors: true,
      shiftHandover: true,
      training: true,
      safety: true,
      kaizen: true,
      evaluations: true,
      analyticsReports: true,
      aiAssist: true,
      moeAnalytics: true,
      advancedAnalytics: true,
      audits: true,
    },
  },
  // Enterprise is priced and sized per customer. With no tier set it is
  // unlimited (the original behaviour); a tier or per-company overrides
  // narrow it — see limitsForCompany().
  enterprise: {
    fullUsers: null,
    lightUsers: null,
    plants: null,
    machines: null,
    inventoryItems: null,
    pmSchedules: null,
    workOrdersPerMonth: null,
    breakdownsPerMonth: null,
    contractors: null,
    trainingModules: null,
    aiCreditsPerMonth: null,
    analyticsHistoryMonths: null,
    features: {
      autoPOEmail: true,
      qrLowStockAlerts: true,
      purchaseOrders: true,
      contractors: true,
      shiftHandover: true,
      training: true,
      safety: true,
      kaizen: true,
      evaluations: true,
      analyticsReports: true,
      aiAssist: true,
      moeAnalytics: true,
      advancedAnalytics: true,
      audits: true,
    },
  },
};

/** Count limits of the sized Enterprise plans (priced individually per customer). */
export type EnterpriseTier = 'enterprise1' | 'enterprise2' | 'enterprise3' | 'unlimited';

export const ENTERPRISE_TIER_LIMITS: Record<EnterpriseTier, PlanCountLimits> = {
  enterprise1: { fullUsers: 100, lightUsers: 500, plants: 5, machines: 300, inventoryItems: 1000, pmSchedules: 300, workOrdersPerMonth: 1000, breakdownsPerMonth: 600, contractors: 100, trainingModules: 100, aiCreditsPerMonth: 2000, analyticsHistoryMonths: null },
  enterprise2: { fullUsers: 250, lightUsers: 1250, plants: 10, machines: 1000, inventoryItems: 5000, pmSchedules: 1000, workOrdersPerMonth: 4000, breakdownsPerMonth: 2000, contractors: 300, trainingModules: 300, aiCreditsPerMonth: 5000, analyticsHistoryMonths: null },
  enterprise3: { fullUsers: 500, lightUsers: 2500, plants: 25, machines: 3000, inventoryItems: 20000, pmSchedules: 3000, workOrdersPerMonth: 12000, breakdownsPerMonth: 6000, contractors: 800, trainingModules: 800, aiCreditsPerMonth: 15000, analyticsHistoryMonths: null },
  unlimited: { fullUsers: null, lightUsers: null, plants: null, machines: null, inventoryItems: null, pmSchedules: null, workOrdersPerMonth: null, breakdownsPerMonth: null, contractors: null, trainingModules: null, aiCreditsPerMonth: null, analyticsHistoryMonths: null },
};

export function planLimitsFor(plan: Plan | undefined | null): PlanLimitConfig {
  // `plan` ultimately comes from a Firestore field that isn't otherwise
  // validated client-side (e.g. set by hand in the console, or a future
  // plan id this build doesn't know about yet) — an unrecognized value
  // must not crash every PlanFeatureGate-protected page with "Cannot read
  // properties of undefined (reading 'features')".
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.starter;
}

/** Company fields that can change its limits beyond the plain plan. */
export interface PlanLimitCompany {
  plan?: Plan | null;
  /** Enterprise only: which sized Enterprise plan the company is on. */
  enterpriseTier?: EnterpriseTier | null;
  /**
   * Per-company count overrides set by Lumora (grandfathered or negotiated
   * limits). A number sets that limit, null makes it unlimited, a missing key
   * keeps the plan's value.
   */
  limitOverrides?: (Partial<Record<CountLimitKey, number | null>> & { users?: number | null }) | null;
}

/**
 * The limits that actually apply to one company: its plan, narrowed to its
 * Enterprise tier when it has one, then any per-company overrides on top.
 */
export function limitsForCompany(company: PlanLimitCompany | undefined | null): PlanLimitConfig {
  const base = planLimitsFor(company?.plan);
  const tier = company?.plan === 'enterprise' && company.enterpriseTier ? ENTERPRISE_TIER_LIMITS[company.enterpriseTier] : null;
  const merged: PlanLimitConfig = { ...base, ...(tier ?? {}), features: base.features };
  const overrides = company?.limitOverrides;
  if (overrides) {
    for (const rawKey of Object.keys(overrides)) {
      // Overrides saved before full/light seats were split used a single `users` cap.
      const key = (rawKey === 'users' ? 'fullUsers' : rawKey) as CountLimitKey;
      if (!(key in merged)) continue;
      const v = overrides[rawKey as keyof typeof overrides];
      if (v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0)) merged[key] = v;
    }
  }
  return merged;
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
 * every feature so companies can try the product; the numeric limits
 * (machines, users, plants…) still follow the Starter plan.
 */
export function isFeatureAvailable(company: PlanCompanyState | null | undefined, feature: FeatureKey): boolean {
  if (company?.status === 'trial' && !isTrialExpired(company)) {
    return true;
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
  ['/app/inventory/purchase-orders', 'purchaseOrders'],
  ['/app/analytics', 'analyticsReports'],
  ['/app/reports', 'analyticsReports'],
  ['/app/audit', 'audits'],
  ['/app/kaizen', 'kaizen'],
  ['/app/evaluations', 'evaluations'],
];

/** The plan feature a path belongs to, or null when it isn't plan-gated. */
export function featureForPath(pathname: string): FeatureKey | null {
  for (const [prefix, feature] of FEATURE_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return feature;
  }
  return null;
}

export interface SeatTally {
  /** Counts of user profile documents. */
  members: { all: number; inactive: number; light: number; lightInactive: number };
  /** Invitations still marked pending, with the time they stop being valid (ms, null = no expiry). */
  invites: Array<{ role: string | null | undefined; expiresAtMs: number | null }>;
}

/**
 * Seats in use. A deactivated account and an invitation past its expiry take no seat; everyone else,
 * plus invitations still waiting to be accepted, does. Light seats are the floor-operator and trainee roles.
 */
export function seatCountsFrom(t: SeatTally, now: number = Date.now()): { full: number; light: number } {
  const liveInvites = t.invites.filter((i) => i.expiresAtMs === null || i.expiresAtMs > now);
  const invLight = liveInvites.filter((i) => seatTypeForRole(i.role) === 'light').length;
  const memberLight = t.members.light - t.members.lightInactive;
  const memberAll = t.members.all - t.members.inactive;
  return { light: memberLight + invLight, full: memberAll - memberLight + (liveInvites.length - invLight) };
}
